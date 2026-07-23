import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { ArenaSession } from "../../application/ArenaSession";
import {
  ARENA_CAPTURE_SCENARIOS,
  applyArenaCaptureScenario,
  readArenaCaptureLayers,
} from "./ArenaCaptureScenarios";

describe("ArenaCaptureScenarios", () => {
  it("loads the RC6 control composition without consuming simulation RNG", () => {
    const first = createExpeditionSession();
    const second = createExpeditionSession();
    const seedsBefore = { ...first.randomStreams.seeds };

    expect(
      applyArenaCaptureScenario(first.world, first.config, "rc6-control"),
    ).toBe(true);
    expect(
      applyArenaCaptureScenario(second.world, second.config, "rc6-control"),
    ).toBe(true);

    expect(first.world).toEqual(second.world);
    expect(first.randomStreams.seeds).toEqual(seedsBefore);
    expect(readArenaCaptureLayers(first.world, first.config)).toEqual(
      ARENA_CAPTURE_SCENARIOS["rc6-control"].expectedLayers,
    );
    expect(first.world.enemies.map((enemy) => enemy.id)).toEqual([
      "enemy-1",
      "capture-enemy-1",
      "capture-enemy-2",
      "capture-enemy-3",
      "capture-enemy-4",
      "capture-enemy-5",
      "capture-enemy-6",
      "capture-enemy-7",
      "capture-enemy-8",
    ]);
    expect(first.world.expedition?.boss).toMatchObject({
      bossId: "final-command-ship",
      phase: 2,
      action: { attackId: "targeted-salvo", phase: "telegraph" },
    });
  });

  it("rejects the Expedition-only control without mutating an Endless world", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({ seed: 20260721, weaponType: "pulse" });
    const before = structuredClone(session.world);

    expect(
      applyArenaCaptureScenario(session.world, session.config, "rc6-control"),
    ).toBe(false);
    expect(session.world).toEqual(before);
  });
});

function createExpeditionSession(): ArenaSession {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260721,
    weaponType: "pulse",
    modeId: "expedition",
    stageId: "final-expedition",
  });
  return session;
}
