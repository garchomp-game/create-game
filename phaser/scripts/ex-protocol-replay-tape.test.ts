import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import { toExProtocolId } from "../src/content/exProtocolCatalog";
import { createWorld } from "../src/simulation/createWorld";
import { setTypedProgressionChoice } from "../src/simulation/progressionChoices";
import {
  ExProtocolReplayCursor,
  parseExProtocolReplayTape,
  serializeExProtocolReplayTape,
  type ExProtocolReplayTape,
} from "./exProtocolReplayTape";

const TAPE: ExProtocolReplayTape = {
  schemaVersion: 1,
  choices: [
    {
      frame: 0,
      ordinal: 0,
      expectedKind: "upgrade",
      id: "rapidFire",
      expectedElapsed: 10,
    },
    {
      frame: 0,
      ordinal: 1,
      expectedKind: "protocol",
      id: "pulse.resonance-relay",
      expectedElapsed: 10,
    },
  ],
  inputs: [
    {
      frame: 0,
      moveX: 0.5,
      moveY: -0.25,
      aimX: 720,
      aimY: 180,
      shootHeld: true,
      specialPressed: false,
    },
  ],
};

describe("EX Protocol replay tape", () => {
  it("round-trips strict typed choices and semantic inputs", () => {
    const serialized = serializeExProtocolReplayTape(TAPE);

    expect(parseExProtocolReplayTape(serialized)).toEqual(TAPE);
    const cursor = new ExProtocolReplayCursor(TAPE);
    expect(cursor.consumeInput(0)).toMatchObject({
      move: { x: 0.5, y: -0.25 },
      aimWorld: { x: 720, y: 180 },
      shootHeld: true,
      specialPressed: false,
    });
  });

  it("fails fast on stale kind, stale ID, key, and elapsed mismatches", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.elapsed = 10;
    world.state.status = "protocolSelect";
    setTypedProgressionChoice(world, {
      kind: "protocol",
      choices: [toExProtocolId("pulse.resonance-relay")],
    });

    expect(() =>
      new ExProtocolReplayCursor(TAPE).consumeChoice(world, 0, 0),
    ).toThrow(/kind mismatch/);

    const staleIdTape = structuredClone(TAPE);
    staleIdTape.choices[0] = {
      ...staleIdTape.choices[0]!,
      expectedKind: "protocol",
      id: "pulse.missing",
    };
    expect(() =>
      new ExProtocolReplayCursor(staleIdTape).consumeChoice(world, 0, 0),
    ).toThrow(/is not offered/);

    expect(() =>
      new ExProtocolReplayCursor(staleIdTape).consumeChoice(world, 1, 0),
    ).toThrow(/key mismatch/);

    const staleElapsedTape = structuredClone(staleIdTape);
    staleElapsedTape.choices[0]!.id = "pulse.resonance-relay";
    staleElapsedTape.choices[0]!.expectedElapsed = 9.5;
    expect(() =>
      new ExProtocolReplayCursor(staleElapsedTape).consumeChoice(world, 0, 0),
    ).toThrow(/elapsed mismatch/);
  });

  it("rejects duplicate and out-of-order keys during parsing", () => {
    expect(() =>
      parseExProtocolReplayTape({
        ...TAPE,
        choices: [TAPE.choices[0], TAPE.choices[0]],
      }),
    ).toThrow(/Duplicate replay choice key/);
    expect(() =>
      parseExProtocolReplayTape({
        ...TAPE,
        inputs: [
          { ...TAPE.inputs[0]!, frame: 2 },
          { ...TAPE.inputs[0]!, frame: 1 },
        ],
      }),
    ).toThrow(/strictly ordered/);
  });
});
