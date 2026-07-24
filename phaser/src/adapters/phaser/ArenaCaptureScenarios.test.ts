import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { ArenaSession } from "../../application/ArenaSession";
import {
  ARENA_CAPTURE_SCENARIOS,
  OBJECT_SEMANTICS_MAGNET_ANCHORS,
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

  it("fixes isolated, overlapping, and magnet-distance object semantics without RNG", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({ seed: 20260724, weaponType: "pulse" });
    const seedsBefore = { ...session.randomStreams.seeds };

    expect(
      applyArenaCaptureScenario(
        session.world,
        session.config,
        "object-semantics-control",
      ),
    ).toBe(true);
    expect(session.randomStreams.seeds).toEqual(seedsBefore);
    expect(readArenaCaptureLayers(session.world, session.config)).toEqual(
      ARENA_CAPTURE_SCENARIOS["object-semantics-control"].expectedLayers,
    );

    const at = (x: number, y: number) => ({
      enemies: session.world.enemies.filter(
        (item) => item.position.x === x && item.position.y === y,
      ).length,
      enemyProjectiles: session.world.enemyProjectiles.filter(
        (item) => item.position.x === x && item.position.y === y,
      ).length,
      playerProjectiles: session.world.bullets.filter(
        (item) => item.position.x === x && item.position.y === y,
      ).length,
      xp: session.world.pickups.filter(
        (item) =>
          item.kind === "xp" &&
          item.position.x === x &&
          item.position.y === y,
      ).length,
      heal: session.world.pickups.filter(
        (item) =>
          item.kind === "heal" &&
          item.position.x === x &&
          item.position.y === y,
      ).length,
    });
    expect(at(300, 250)).toEqual({
      enemies: 0,
      enemyProjectiles: 1,
      playerProjectiles: 0,
      xp: 1,
      heal: 0,
    });
    expect(at(660, 250)).toEqual({
      enemies: 0,
      enemyProjectiles: 1,
      playerProjectiles: 0,
      xp: 0,
      heal: 1,
    });
    expect(at(480, 250)).toEqual({
      enemies: 1,
      enemyProjectiles: 1,
      playerProjectiles: 1,
      xp: 1,
      heal: 1,
    });

    const magnetDistances = session.world.pickups
      .filter((pickup) => pickup.id.startsWith("capture-pickup-"))
      .map((pickup) =>
        Math.hypot(
          pickup.position.x - session.world.player.position.x,
          pickup.position.y - session.world.player.position.y,
        ),
      )
      .filter((distance) =>
        OBJECT_SEMANTICS_MAGNET_ANCHORS.some(
          (anchor) => anchor.distance === distance,
        ),
      )
      .sort((left, right) => right - left);
    expect(magnetDistances).toEqual(
      OBJECT_SEMANTICS_MAGNET_ANCHORS.map((anchor) => anchor.distance),
    );
    expect(session.world.obstacles).toEqual([]);
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
