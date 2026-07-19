import { describe, expect, it } from "vitest";
import { ArenaSession } from "../src/application/ArenaSession";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type {
  GameEvent,
  PlayerDamageSource,
  WeaponTypeId,
} from "../src/domain/types";
import { createAutoPilotAgent } from "../src/simulation/autoPilot";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_SEEDS = [20260717, 20260718, 20260719] as const;
const SEEDS = readNumberList("ARENA_PROBE_SEEDS", DEFAULT_SEEDS);
const WEAPONS = readWeaponList();
const FRAME_RATE = 30;
const MAX_SECONDS = 15 * 60;

type ProbeResult = {
  weaponType: WeaponTypeId;
  seed: number;
  elapsed: number;
  score: number;
  level: number;
  extraLevel: number;
  enemiesKilled: number;
  xpCollected: number;
  outcome: "victory" | "defeat" | null;
  reachedActId: string | null;
  longestMeaningfulGap: number;
  bossSpawnedAt: number | null;
  bossPhaseReached: number;
  bossAttacksExecuted: Record<string, number>;
  bossCommandPulseResults: Record<string, number>;
  bossKills: number;
  bossHealPickupsSpawned: number;
  bossHealDropsSuppressed: number;
  bossHealPickupsCollected: number;
  bossHpRecovered: number;
  bossHpRemaining: number | null;
  clearScoreBonus: number;
  timeScoreBonus: number;
  bossFightDuration: number | null;
  bossActiveFrames: number;
  bossAimFrames: number;
  commanderSpawned: number;
  commanderKilled: number;
  lastDamageSource: PlayerDamageSource | null;
  maximumEnemies: number;
  maximumProjectiles: number;
  maximumPickups: number;
  eventHash: string;
  worldHash: string;
};

describe("v0.7 final Expedition release probe", () => {
  it("reaches the final phase, preserves weapon clears, and remains deterministic", () => {
    const results = WEAPONS.flatMap((weaponType) =>
      SEEDS.map((seed) => runExpedition(weaponType, seed)),
    );
    const replay = process.env.ARENA_PROBE_SKIP_REPLAY === "1"
      ? null
      : runExpedition("pulse", SEEDS[0]!);

    console.log(JSON.stringify(results, null, 2));

    for (const result of results) {
      expect(result.outcome).not.toBeNull();
      expect(result.reachedActId).toBe("command-ship");
      expect(result.elapsed).toBeGreaterThanOrEqual(390);
      expect(result.elapsed).toBeLessThanOrEqual(MAX_SECONDS);
      expect(result.longestMeaningfulGap).toBeLessThan(120);
      expect(result.bossSpawnedAt).not.toBeNull();
      expect(result.bossPhaseReached).toBe(2);
      expect(result.bossAttacksExecuted["targeted-salvo"]).toBeGreaterThan(0);
      expect(result.bossAttacksExecuted["escort-pincer"]).toBeGreaterThan(0);
      expect(result.bossAttacksExecuted["command-pulse"]).toBeGreaterThan(0);
      expect(result.commanderSpawned).toBe(1);
      expect(result.commanderKilled).toBe(1);
      expect(result.maximumEnemies).toBeLessThanOrEqual(96);
      expect(result.maximumProjectiles).toBeLessThanOrEqual(160);
      expect(result.maximumPickups).toBeLessThanOrEqual(2_000);
    }

    for (const weaponType of WEAPONS) {
      expect(
        results.some(
          (result) => result.weaponType === weaponType && result.outcome === "victory",
        ),
      ).toBe(true);
    }

    if (replay) {
      expect(replay.eventHash).toBe(results[0]!.eventHash);
      expect(replay.worldHash).toBe(results[0]!.worldHash);
    }
  }, 480_000);
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
    stageId: "final-expedition",
    status: "playing",
  });

  const eventDigest: string[] = [];
  let maximumEnemies = 0;
  let maximumProjectiles = 0;
  let maximumPickups = 0;
  let bossActiveFrames = 0;
  let bossAimFrames = 0;
  for (let frame = 0; frame < MAX_SECONDS * FRAME_RATE; frame += 1) {
    const decision = agent.decide(session.world, session.config);
    const activeBossId = session.world.expedition?.boss?.status === "active"
      ? session.world.expedition.boss.enemyId
      : null;
    if (activeBossId) {
      bossActiveFrames += 1;
      if (decision.aimTargetId === activeBossId) bossAimFrames += 1;
    }
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
  const commander = session.world.stats.encounterMetrics.commander;
  const activeBoss = session.world.enemies.find((enemy) => enemy.boss);
  return {
    weaponType,
    seed,
    elapsed: session.world.state.elapsed,
    score: session.world.state.score,
    level: session.world.progression.level,
    extraLevel: session.world.progression.extraLevel,
    enemiesKilled: session.world.stats.enemiesKilled,
    xpCollected: session.world.stats.xpCollected,
    outcome: expedition?.outcome ?? null,
    reachedActId: expedition?.reachedActId ?? null,
    longestMeaningfulGap: expedition?.longestMeaningfulGap ?? Number.POSITIVE_INFINITY,
    bossSpawnedAt: boss?.spawnedAt ?? null,
    bossPhaseReached: boss?.phaseReached ?? 0,
    bossAttacksExecuted: { ...(boss?.attacksExecuted ?? {}) },
    bossCommandPulseResults: { ...(boss?.commandPulseResults ?? {}) },
    bossKills: boss?.killsDuringBoss ?? 0,
    bossHealPickupsSpawned: boss?.healPickupsSpawned ?? 0,
    bossHealDropsSuppressed: boss?.healDropsSuppressed ?? 0,
    bossHealPickupsCollected: boss?.healPickupsCollected ?? 0,
    bossHpRecovered: boss?.hpRecoveredDuringBoss ?? 0,
    bossHpRemaining: activeBoss?.hp ?? null,
    clearScoreBonus: expedition?.clearScoreBonus ?? 0,
    timeScoreBonus: expedition?.timeScoreBonus ?? 0,
    bossFightDuration: expedition?.bossFightDuration ?? null,
    bossActiveFrames,
    bossAimFrames,
    commanderSpawned: commander?.spawned ?? 0,
    commanderKilled: commander?.killed ?? 0,
    lastDamageSource: session.world.stats.lastDamageSource,
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

function readNumberList(
  name: string,
  fallback: readonly number[],
): number[] {
  const value = process.env[name];
  if (!value) return [...fallback];
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0);
  if (parsed.length === 0) throw new Error(`${name} must contain a seed.`);
  return parsed;
}

function readWeaponList(): WeaponTypeId[] {
  const value = process.env.ARENA_PROBE_WEAPONS;
  if (!value) return ["pulse", "spread"];
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is WeaponTypeId => item === "pulse" || item === "spread");
  if (parsed.length === 0) {
    throw new Error("ARENA_PROBE_WEAPONS must include pulse or spread.");
  }
  return parsed;
}
