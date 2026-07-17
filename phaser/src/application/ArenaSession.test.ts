import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { InputSnapshot } from "../domain/types";
import { createRandomStreams } from "../math/random";
import { createWorld } from "../simulation/createWorld";
import { stepWorld } from "../simulation/stepWorld";
import { ArenaSession } from "./ArenaSession";

const input: InputSnapshot = {
  move: { x: 0.6, y: -0.2 },
  aimWorld: { x: 840, y: 120 },
  startPressed: false,
  shootHeld: true,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
};

describe("ArenaSession", () => {
  it("preserves the direct simulation result for the same seed and input sequence", () => {
    const seed = 424242;
    const config = { ...SIMULATION_CONFIG, seed };
    const directWorld = createWorld(config);
    directWorld.state.weaponType = "spread";
    const directRandom = createRandomStreams(seed);
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({ seed, weaponType: "spread" });

    for (let index = 0; index < 180; index += 1) {
      const directResult = stepWorld(directWorld, input, 1 / 60, directRandom, config);
      const sessionResult = session.step(input, 1 / 60);
      expect(sessionResult).toEqual(directResult);
    }

    expect(session.world).toEqual(directWorld);
    expect(session.randomStreams.seeds).toEqual(directRandom.seeds);
    expect(session.modeId).toBe("endless");
    expect(session.stageId).toBe("arena-default");
  });

  it("owns the active seed, config, weapon, and status without mirror state", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({ seed: -1, weaponType: "pulse", status: "title" });

    expect(session.seed).toBe(0xffffffff);
    expect(session.config.seed).toBe(0xffffffff);
    expect(session.randomStreams.rootSeed).toBe(0xffffffff);
    expect(session.world.state).toMatchObject({ weaponType: "pulse", status: "title" });
    expect(session.stage).toMatchObject({
      id: "arena-default",
      clearCondition: { type: "endless" },
    });
  });

  it("requires an active run before exposing state", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    expect(() => session.world).toThrow("ArenaSession has not been started.");
  });
});
