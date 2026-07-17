import { describe, expect, it } from "vitest";
import { ArenaSession } from "../src/application/ArenaSession";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type { GameEvent, WeaponTypeId } from "../src/domain/types";
import { createAutoPilotAgent } from "../src/simulation/autoPilot";

const SEEDS = [20260717, 20260718, 20260719] as const;
const WEAPONS: WeaponTypeId[] = ["pulse", "spread"];
const FRAME_RATE = 30;
const MAX_SECONDS = 10 * 60;

type ProbeResult = {
  weaponType: WeaponTypeId;
  seed: number;
  elapsed: number;
  score: number;
  outcome: "victory" | "defeat" | null;
  reachedActId: string | null;
  longestMeaningfulGap: number;
  bossSpawnedAt: number | null;
  bossPhaseReached: number;
  bossAttacksExecuted: Record<string, number>;
  maximumEnemies: number;
  maximumProjectiles: number;
  maximumPickups: number;
  eventHash: string;
  worldHash: string;
};

describe("v0.7 first Expedition release probe", () => {
  it("clears with both weapons across three seeds and remains deterministic", () => {
    const results = WEAPONS.flatMap((weaponType) =>
      SEEDS.map((seed) => runExpedition(weaponType, seed)),
    );
    const replay = runExpedition("pulse", SEEDS[0]);

    for (const result of results) {
      expect(result.outcome).toBe("victory");
      expect(result.reachedActId).toBe("command-ship");
      expect(result.elapsed).toBeGreaterThanOrEqual(8 * 60);
      expect(result.elapsed).toBeLessThanOrEqual(MAX_SECONDS);
      expect(result.longestMeaningfulGap).toBeLessThan(120);
      expect(result.bossSpawnedAt).not.toBeNull();
      expect(result.bossPhaseReached).toBe(2);
      expect(result.bossAttacksExecuted["targeted-salvo"]).toBeGreaterThan(0);
      expect(result.bossAttacksExecuted["escort-pincer"]).toBeGreaterThan(0);
      expect(result.maximumEnemies).toBeLessThanOrEqual(
        SIMULATION_CONFIG.threat.maximumEnemies,
      );
      expect(result.maximumProjectiles).toBeLessThanOrEqual(300);
      expect(result.maximumPickups).toBeLessThanOrEqual(2_000);
    }

    expect(replay.eventHash).toBe(results[0]!.eventHash);
    expect(replay.worldHash).toBe(results[0]!.worldHash);
    console.log(JSON.stringify(results, null, 2));
  }, 240_000);
});

function runExpedition(weaponType: WeaponTypeId, seed: number): ProbeResult {
  const session = new ArenaSession(SIMULATION_CONFIG);
  const agent = createAutoPilotAgent(undefined, {
    profile: "ceiling",
    patrolStrategy: "visit-history-v1",
  });
  session.start({
    seed,
    weaponType,
    modeId: "expedition",
    stageId: "first-expedition",
    status: "playing",
  });

  const eventDigest: string[] = [];
  let maximumEnemies = 0;
  let maximumProjectiles = 0;
  let maximumPickups = 0;
  for (let frame = 0; frame < MAX_SECONDS * FRAME_RATE; frame += 1) {
    const decision = agent.decide(session.world, session.config);
    const result = session.step(decision.input, 1 / FRAME_RATE);
    eventDigest.push(...result.events.map(formatEventForHash));
    maximumEnemies = Math.max(maximumEnemies, session.world.enemies.length);
    maximumProjectiles = Math.max(
      maximumProjectiles,
      session.world.bullets.length + session.world.enemyProjectiles.length,
    );
    maximumPickups = Math.max(maximumPickups, session.world.pickups.length);
    if (session.world.state.status === "gameOver") break;
  }

  const expedition = session.world.stats.encounterMetrics.expedition;
  const boss = session.world.stats.encounterMetrics.boss;
  return {
    weaponType,
    seed,
    elapsed: session.world.state.elapsed,
    score: session.world.state.score,
    outcome: expedition?.outcome ?? null,
    reachedActId: expedition?.reachedActId ?? null,
    longestMeaningfulGap: expedition?.longestMeaningfulGap ?? Number.POSITIVE_INFINITY,
    bossSpawnedAt: boss?.spawnedAt ?? null,
    bossPhaseReached: boss?.phaseReached ?? 0,
    bossAttacksExecuted: { ...(boss?.attacksExecuted ?? {}) },
    maximumEnemies,
    maximumProjectiles,
    maximumPickups,
    eventHash: stableHash(JSON.stringify(eventDigest)),
    worldHash: stableHash(JSON.stringify(session.world)),
  };
}

function formatEventForHash(event: GameEvent): string {
  return JSON.stringify(event);
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
