import { z } from "zod";
import type {
  ContractChoiceId,
  InputSnapshot,
  ProgressionPendingChoice,
  WorldState,
} from "../src/domain/types";

const choiceKindSchema = z.enum([
  "upgrade",
  "protocol",
  "evolution-one",
  "evolution-two",
  "limit-break",
  "contract",
]);

const replayChoiceSchema = z
  .object({
    frame: z.number().int().nonnegative(),
    ordinal: z.number().int().nonnegative(),
    expectedKind: choiceKindSchema,
    id: z.string().min(1),
    expectedElapsed: z.number().finite().nonnegative(),
  })
  .strict();

const replayInputSchema = z
  .object({
    frame: z.number().int().nonnegative(),
    moveX: z.number().finite().min(-1).max(1),
    moveY: z.number().finite().min(-1).max(1),
    aimX: z.number().finite(),
    aimY: z.number().finite(),
    shootHeld: z.boolean().optional(),
    pausePressed: z.boolean().optional(),
    specialPressed: z.boolean().optional(),
  })
  .strict();

const replayTapeSchema = z
  .object({
    schemaVersion: z.literal(1),
    choices: z.array(replayChoiceSchema),
    inputs: z.array(replayInputSchema),
  })
  .strict()
  .superRefine((tape, context) => {
    validateOrderedUniqueKeys(
      tape.choices,
      ({ frame, ordinal }) => `${frame}:${ordinal}`,
      ({ frame, ordinal }) => frame * 1_000_000 + ordinal,
      "choice",
      context,
    );
    validateOrderedUniqueKeys(
      tape.inputs,
      ({ frame }) => String(frame),
      ({ frame }) => frame,
      "input",
      context,
    );
  });

export type ReplayChoiceKind = z.infer<typeof choiceKindSchema>;
export type ReplayChoice = z.infer<typeof replayChoiceSchema>;
export type ReplayInput = z.infer<typeof replayInputSchema>;
export type ExProtocolReplayTape = z.infer<typeof replayTapeSchema>;

export function parseExProtocolReplayTape(
  value: string | unknown,
): ExProtocolReplayTape {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return replayTapeSchema.parse(parsed);
}

export function serializeExProtocolReplayTape(
  tape: ExProtocolReplayTape,
): string {
  return JSON.stringify(replayTapeSchema.parse(tape));
}

export class ExProtocolReplayCursor {
  private choiceIndex = 0;
  private inputIndex = 0;

  constructor(private readonly tape: ExProtocolReplayTape) {}

  consumeInput(frame: number): InputSnapshot {
    const entry = this.tape.inputs[this.inputIndex];
    if (!entry || entry.frame !== frame) {
      throw new Error(
        `Replay input mismatch at frame ${frame}; expected ${entry?.frame ?? "end-of-tape"}.`,
      );
    }
    this.inputIndex += 1;
    return {
      move: { x: entry.moveX, y: entry.moveY },
      aimWorld: { x: entry.aimX, y: entry.aimY },
      startPressed: false,
      shootHeld: entry.shootHeld ?? true,
      restartPressed: false,
      pausePressed: entry.pausePressed ?? false,
      quitToTitlePressed: false,
      upgradeChoicePressed: null,
      contractChoicePressed: null,
      tutorialContinuePressed: false,
      specialPressed: entry.specialPressed ?? false,
    };
  }

  consumeChoice(
    world: WorldState,
    frame: number,
    ordinal: number,
  ): Pick<InputSnapshot, "upgradeChoicePressed" | "contractChoicePressed"> {
    const entry = this.tape.choices[this.choiceIndex];
    if (!entry) {
      throw new Error(
        `Unexpected replay choice at ${frame}:${ordinal}; tape is exhausted.`,
      );
    }
    if (entry.frame !== frame || entry.ordinal !== ordinal) {
      throw new Error(
        `Replay choice key mismatch at ${frame}:${ordinal}; expected ${entry.frame}:${entry.ordinal}.`,
      );
    }

    const pending = readPendingChoice(world);
    if (pending.kind !== entry.expectedKind) {
      throw new Error(
        `Replay choice kind mismatch at ${frame}:${ordinal}; expected ${entry.expectedKind}, received ${pending.kind}.`,
      );
    }
    if (Math.abs(world.state.elapsed - entry.expectedElapsed) > 1e-6) {
      throw new Error(
        `Replay elapsed mismatch at ${frame}:${ordinal}; expected ${entry.expectedElapsed}, received ${world.state.elapsed}.`,
      );
    }
    const choiceIndex = pending.choices.indexOf(entry.id);
    if (choiceIndex < 0) {
      throw new Error(
        `Replay choice ID "${entry.id}" is not offered for ${entry.expectedKind} at ${frame}:${ordinal}.`,
      );
    }
    this.choiceIndex += 1;
    return entry.expectedKind === "contract"
      ? {
          upgradeChoicePressed: null,
          contractChoicePressed: choiceIndex,
        }
      : {
          upgradeChoicePressed: choiceIndex,
          contractChoicePressed: null,
        };
  }

  assertExhausted(): void {
    if (
      this.choiceIndex !== this.tape.choices.length ||
      this.inputIndex !== this.tape.inputs.length
    ) {
      throw new Error(
        `Replay tape is not exhausted: choices ${this.choiceIndex}/${this.tape.choices.length}, inputs ${this.inputIndex}/${this.tape.inputs.length}.`,
      );
    }
  }
}

function readPendingChoice(world: WorldState): {
  kind: ReplayChoiceKind;
  choices: string[];
} {
  if (
    world.state.status === "contractSelect" &&
    world.encounter.contract.status === "offered"
  ) {
    return {
      kind: "contract",
      choices: ["standard", "overdrive"] satisfies ContractChoiceId[],
    };
  }
  const pending: ProgressionPendingChoice | undefined =
    world.progression.pendingChoice;
  if (!pending) {
    throw new Error(
      `Replay expected a choice while world status is "${world.state.status}".`,
    );
  }
  return { kind: pending.kind, choices: [...pending.choices] };
}

function validateOrderedUniqueKeys<T>(
  entries: T[],
  keyOf: (entry: T) => string,
  orderOf: (entry: T) => number,
  label: string,
  context: z.RefinementCtx,
): void {
  const keys = new Set<string>();
  let previousOrder = -1;
  entries.forEach((entry, index) => {
    const key = keyOf(entry);
    const order = orderOf(entry);
    if (keys.has(key)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate replay ${label} key ${key}.`,
        path: [label === "choice" ? "choices" : "inputs", index],
      });
    }
    if (order <= previousOrder) {
      context.addIssue({
        code: "custom",
        message: `Replay ${label} entries must be strictly ordered.`,
        path: [label === "choice" ? "choices" : "inputs", index],
      });
    }
    keys.add(key);
    previousOrder = order;
  });
}
