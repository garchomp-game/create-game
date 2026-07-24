import { describe, expect, it } from "vitest";
import { ArenaSession } from "../src/application/ArenaSession";
import { EX_PROTOCOL_CATALOG } from "../src/content/exProtocolCatalog";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type {
  GameEvent,
  WorldState,
} from "../src/domain/types";
import {
  offerExProtocolEvolution,
} from "../src/simulation/exProtocolProgression";
import {
  setLimitBreakChoices,
  setTypedProgressionChoice,
} from "../src/simulation/progressionChoices";
import {
  ExProtocolReplayCursor,
  serializeExProtocolReplayTape,
  type ExProtocolReplayTape,
} from "./exProtocolReplayTape";

const SIGNATURES = EX_PROTOCOL_CATALOG.protocols.map(
  (protocol, index) => ({
    id: protocol.id,
    weaponId: protocol.weaponId,
    protocolIndex: index % 3,
  }),
);

describe("EX Protocol deterministic signature probes", () => {
  it.each(SIGNATURES)(
    "$id replays the same input tape to an identical full digest",
    ({ id, weaponId, protocolIndex }) => {
      const tape = createSignatureTape(id);
      const leftReplay = createSignatureSession(
        weaponId,
        protocolIndex,
        tape,
      );
      const rightReplay = createSignatureSession(
        weaponId,
        protocolIndex,
        tape,
      );
      const left = leftReplay.session;
      const right = rightReplay.session;
      prepareActiveCharge(left.world);
      prepareActiveCharge(right.world);
      const leftEvents: GameEvent[] = [];
      const rightEvents: GameEvent[] = [];

      for (let frame = 4; frame < 604; frame += 1) {
        const leftInput = leftReplay.cursor.consumeInput(frame);
        const rightInput = rightReplay.cursor.consumeInput(frame);
        expect(rightInput).toEqual(leftInput);
        const input = leftInput;
        leftEvents.push(...left.step(input, 1 / 60).events);
        rightEvents.push(...right.step(rightInput, 1 / 60).events);
      }
      leftReplay.cursor.assertExhausted();
      rightReplay.cursor.assertExhausted();

      const inputHash = stableHash(
        serializeExProtocolReplayTape(tape),
      );
      const leftEventHash = stableHash(JSON.stringify(leftEvents));
      const rightEventHash = stableHash(JSON.stringify(rightEvents));
      const leftWorldHash = stableHash(JSON.stringify(left.world));
      const rightWorldHash = stableHash(JSON.stringify(right.world));
      expect(inputHash).not.toBe("00000000");
      expect(rightEventHash).toBe(leftEventHash);
      expect(rightWorldHash).toBe(leftWorldHash);
      expect(right.world).toEqual(left.world);
    },
  );
});

function createSignatureSession(
  weaponId: "pulse" | "spread",
  protocolIndex: number,
  tape: ExProtocolReplayTape,
): { session: ArenaSession; cursor: ExProtocolReplayCursor } {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260723,
    weaponType: weaponId,
    rulesetProfileId: "candidate-ex-endless-c2",
  });
  prepareFinalNormalChoice(session.world);
  const cursor = new ExProtocolReplayCursor(tape);
  const frameZeroInput = cursor.consumeInput(0);
  session.step(
    {
      ...frameZeroInput,
      ...cursor.consumeChoice(session.world, 0, 0),
    },
    0,
  );
  expect(session.world.state.status).toBe("protocolSelect");
  session.step(
    {
      ...frameZeroInput,
      ...cursor.consumeChoice(session.world, 0, 1),
    },
    0,
  );

  for (const tier of [1, 2] as const) {
    session.world.progression.extraLevel = tier;
    const events: GameEvent[] = [];
    expect(
      offerExProtocolEvolution(session.world, tier, events),
    ).toBe(true);
    const input = cursor.consumeInput(tier);
    session.step(
      {
        ...input,
        ...cursor.consumeChoice(session.world, tier, 0),
      },
      0,
    );
  }

  session.world.progression.extraLevel = 3;
  setLimitBreakChoices(session.world, ["limitPower"], session.config);
  session.world.state.status = "upgradeSelect";
  const limitBreakInput = cursor.consumeInput(3);
  session.step(
    {
      ...limitBreakInput,
      ...cursor.consumeChoice(session.world, 3, 0),
    },
    0,
  );
  expect(session.world.progression.exProtocol).toMatchObject({
    status: "selected",
    route: {
      protocolId: EX_PROTOCOL_CATALOG.protocols.find(
        ({ weaponId: candidateWeapon }, index) =>
          candidateWeapon === weaponId && index % 3 === protocolIndex,
      )?.id,
      evolutionOneId:
        EX_PROTOCOL_CATALOG.protocols.find(
          ({ weaponId: candidateWeapon }, index) =>
            candidateWeapon === weaponId && index % 3 === protocolIndex,
        )?.evolutionOne[0].id,
      evolutionTwoId:
        EX_PROTOCOL_CATALOG.protocols.find(
          ({ weaponId: candidateWeapon }, index) =>
            candidateWeapon === weaponId && index % 3 === protocolIndex,
        )?.evolutionTwo[0].id,
      masteryUnlocked: true,
    },
  });
  return { session, cursor };
}

function prepareFinalNormalChoice(world: WorldState): void {
  for (const upgradeId of Object.keys(
    world.progression.upgradeRanks,
  ) as Array<keyof typeof world.progression.upgradeRanks>) {
    const definition = SIMULATION_CONFIG.upgrades[upgradeId];
    world.progression.upgradeRanks[upgradeId] = definition.maxRank;
  }
  world.progression.upgradeRanks.rapidFire -= 1;
  world.progression.pendingUpgradeChoices = ["rapidFire"];
  setTypedProgressionChoice(world, {
    kind: "upgrade",
    choices: ["rapidFire"],
  });
  world.state.elapsed = 100;
  world.state.status = "upgradeSelect";
}

function prepareActiveCharge(world: WorldState): void {
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return;
  if (
    progression.runtime.kind === "full-span-tidal-sweep" ||
    progression.runtime.kind === "breakwater-fan"
  ) {
    progression.runtime.charges = 1;
  }
}

function createSignatureTape(
  protocolId: string,
): ExProtocolReplayTape {
  const protocol = EX_PROTOCOL_CATALOG.protocols.find(
    ({ id }) => id === protocolId,
  );
  if (!protocol) throw new Error(`Unknown Protocol "${protocolId}".`);
  return {
    schemaVersion: 1,
    choices: [
      {
        frame: 0,
        ordinal: 0,
        expectedKind: "upgrade",
        id: "rapidFire",
        expectedElapsed: 100,
      },
      {
        frame: 0,
        ordinal: 1,
        expectedKind: "protocol",
        id: protocol.id,
        expectedElapsed: 100,
      },
      {
        frame: 1,
        ordinal: 0,
        expectedKind: "evolution-one",
        id: protocol.evolutionOne[0].id,
        expectedElapsed: 100,
      },
      {
        frame: 2,
        ordinal: 0,
        expectedKind: "evolution-two",
        id: protocol.evolutionTwo[0].id,
        expectedElapsed: 100,
      },
      {
        frame: 3,
        ordinal: 0,
        expectedKind: "limit-break",
        id: "limitPower",
        expectedElapsed: 100,
      },
    ],
    inputs: Array.from({ length: 604 }, (_, frame) => ({
      frame,
      moveX: frame % 240 < 120 ? 0.6 : -0.6,
      moveY: frame % 180 < 90 ? -0.25 : 0.25,
      aimX: 480 + Math.cos(frame / 45) * 320,
      aimY: 270 + Math.sin(frame / 45) * 180,
      shootHeld: true,
      specialPressed: frame === 4 || frame === 364,
    })),
  };
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
