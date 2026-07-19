import { describe, expect, it } from "vitest";
import { ArenaSession } from "../src/application/ArenaSession";
import {
  FINAL_COMMAND_SHIP_REPAIR_BUDGET_CANDIDATE_A,
  type FinalCommandShipDefinition,
} from "../src/content/bossCatalog";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type {
  GameEvent,
  InputSnapshot,
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

export type ProbeResult = {
  sustainProfile: string;
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
  bossHealValueSupplied: number;
  bossHealDropsSuppressed: number;
  bossHealDropsSuppressedCooldown: number;
  bossHealDropsSuppressedBudget: number;
  bossHealPickupsCollected: number;
  bossHealPickupsCollectedAtFullHp: number;
  bossHealPickupsExpired: number;
  bossDamageTaken: number;
  bossHpRecovered: number;
  bossRepairOffsetRatio: number | null;
  bossRepairBudgetInitial: number | null;
  bossRepairBudgetSpent: number;
  bossRepairBudgetRemaining: number | null;
  bossHpRemaining: number | null;
  tacticalScore: number;
  clearScoreBonus: number;
  timeScoreBonus: number;
  timeMedal: "gold" | "silver" | "bronze" | null;
  bossFightDuration: number | null;
  bossActiveFrames: number;
  bossAimFrames: number;
  bossCenterFrames: number;
  bossOuterFrames: number;
  bossCoverFrames: number;
  bossOuterEntries: number;
  bossCoverEntries: number;
  bossTravelDistance: number;
  bossRegularEnemiesKilled: number;
  commanderSpawned: number;
  commanderKilled: number;
  lastDamageSource: PlayerDamageSource | null;
  maximumEnemies: number;
  maximumProjectiles: number;
  maximumPickups: number;
  inputFrames: number;
  inputTapeExhausted: boolean;
  inputHash: string;
  eventHash: string;
  worldHash: string;
};

export type ProbeRunOptions = {
  bossSustain?: FinalCommandShipDefinition["sustain"];
  sustainProfile?: string;
  inputTape?: readonly InputSnapshot[];
  bossInputMode?: "auto" | "center-orbit";
};

export type ProbeExecution = {
  result: ProbeResult;
  inputTape: InputSnapshot[];
};

describe("v0.7 final Expedition release probe", () => {
  it("reaches the final phase, preserves weapon clears, and remains deterministic", () => {
    if (process.env.ARENA_PROBE_KIND === "repair-budget") return;
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
      expect(result.timeScoreBonus).toBe(0);
      if (result.outcome === "victory") {
        expect(result.score).toBe(result.tacticalScore + result.clearScoreBonus);
        expect(result.timeMedal).toBe(expectedTimeMedal(result.elapsed));
      } else {
        expect(result.clearScoreBonus).toBe(0);
        expect(result.timeMedal).toBeNull();
      }
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

  it("pairs RC6 control with finite repair candidate A using the same inputs", () => {
    if (process.env.ARENA_PROBE_KIND !== "repair-budget") return;
    const bossInputMode = process.env.ARENA_REPAIR_INPUT_MODE === "center-orbit"
      ? "center-orbit"
      : "auto";
    const replayFixtures: Array<{
      weaponType: WeaponTypeId;
      seed: number;
      inputTape: InputSnapshot[];
      expected: ProbeResult;
    }> = [];
    const pairs = WEAPONS.flatMap((weaponType) =>
      SEEDS.map((seed) => {
        const control = executeExpedition(weaponType, seed, {
          sustainProfile: "control",
          bossInputMode,
        });
        const candidate = executeExpedition(weaponType, seed, {
          bossSustain: FINAL_COMMAND_SHIP_REPAIR_BUDGET_CANDIDATE_A.sustain,
          sustainProfile: "candidate-a-2400",
          inputTape: control.inputTape,
        });
        if (replayFixtures.length === 0) {
          replayFixtures.push({
            weaponType,
            seed,
            inputTape: control.inputTape,
            expected: candidate.result,
          });
        }
        return {
          control: control.result,
          candidate: candidate.result,
          expectedCandidateInputHash: stableHash(JSON.stringify(
            control.inputTape.slice(0, candidate.result.inputFrames),
          )),
        };
      }),
    );

    const candidateMeetsAdoptionGate = pairs.every(({ candidate }) =>
      candidate.outcome === "victory" &&
      candidate.bossRepairOffsetRatio !== null &&
      candidate.bossRepairOffsetRatio < 0.9 &&
      candidate.bossRegularEnemiesKilled > 0 &&
      candidate.bossOuterEntries + candidate.bossCoverEntries > 0
    );
    console.log(JSON.stringify({
      inputMode: bossInputMode,
      candidateMeetsAdoptionGate,
      pairs,
    }, null, 2));
    expect(candidateMeetsAdoptionGate).toBe(false);

    for (const { control, candidate, expectedCandidateInputHash } of pairs) {
      expect(control.reachedActId).toBe("command-ship");
      expect(candidate.reachedActId).toBe("command-ship");
      if (bossInputMode === "auto") {
        expect(control.bossPhaseReached).toBe(2);
        expect(candidate.bossPhaseReached).toBe(2);
      } else {
        expect(control.bossPhaseReached).toBeGreaterThanOrEqual(1);
        expect(candidate.bossPhaseReached).toBeGreaterThanOrEqual(1);
      }
      expect(candidate.bossRepairBudgetInitial).toBe(2_400);
      expect(candidate.bossRepairBudgetSpent).toBeLessThanOrEqual(2_400);
      expect(candidate.bossRepairBudgetRemaining).toBe(
        2_400 - candidate.bossRepairBudgetSpent,
      );
      expect(candidate.inputTapeExhausted || candidate.outcome !== null).toBe(true);
      expect(candidate.inputHash).toBe(expectedCandidateInputHash);
    }

    if (process.env.ARENA_PROBE_SKIP_REPLAY !== "1") {
      const fixture = replayFixtures[0]!;
      const replay = executeExpedition(fixture.weaponType, fixture.seed, {
        bossSustain: FINAL_COMMAND_SHIP_REPAIR_BUDGET_CANDIDATE_A.sustain,
        sustainProfile: "candidate-a-2400",
        inputTape: fixture.inputTape,
      }).result;
      expect(replay.inputHash).toBe(fixture.expected.inputHash);
      expect(replay.eventHash).toBe(fixture.expected.eventHash);
      expect(replay.worldHash).toBe(fixture.expected.worldHash);
    }
  }, 900_000);
});

export function runExpedition(
  weaponType: WeaponTypeId,
  seed: number,
  options: ProbeRunOptions = {},
): ProbeResult {
  return executeExpedition(weaponType, seed, options).result;
}

export function executeExpedition(
  weaponType: WeaponTypeId,
  seed: number,
  options: ProbeRunOptions = {},
): ProbeExecution {
  const session = new ArenaSession(SIMULATION_CONFIG, undefined, {
    finalExpeditionBossSustain: options.bossSustain,
  });
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
  const inputTape: InputSnapshot[] = [];
  let maximumEnemies = 0;
  let maximumProjectiles = 0;
  let maximumPickups = 0;
  let bossActiveFrames = 0;
  let bossAimFrames = 0;
  let bossCenterFrames = 0;
  let bossOuterFrames = 0;
  let bossCoverFrames = 0;
  let bossOuterEntries = 0;
  let bossCoverEntries = 0;
  let bossTravelDistance = 0;
  let bossRegularEnemiesKilled = 0;
  let wasOuter = false;
  let wasNearCover = false;
  let previousBossPosition: { x: number; y: number } | null = null;
  let inputTapeExhausted = false;
  for (let frame = 0; frame < MAX_SECONDS * FRAME_RATE; frame += 1) {
    if (options.inputTape && frame >= options.inputTape.length) {
      inputTapeExhausted = true;
      break;
    }
    const decision = agent.decide(session.world, session.config);
    const activeBossId = session.world.expedition?.boss?.status === "active"
      ? session.world.expedition.boss.enemyId
      : null;
    const activeBoss = activeBossId
      ? session.world.enemies.find((enemy) => enemy.id === activeBossId) ?? null
      : null;
    let input = options.inputTape
      ? cloneInput(options.inputTape[frame]!)
      : cloneInput(decision.input);
    if (
      !options.inputTape &&
      options.bossInputMode === "center-orbit" &&
      activeBoss
    ) {
      input = createCenterOrbitInput(session, activeBoss.position, input);
    }
    inputTape.push(cloneInput(input));
    if (activeBossId) {
      bossActiveFrames += 1;
      if (decision.aimTargetId === activeBossId || options.bossInputMode === "center-orbit") {
        bossAimFrames += 1;
      }
      const zone = classifyBossPosition(session);
      if (zone.center) bossCenterFrames += 1;
      if (zone.outer) bossOuterFrames += 1;
      if (zone.nearCover) bossCoverFrames += 1;
      if (zone.outer && !wasOuter) bossOuterEntries += 1;
      if (zone.nearCover && !wasNearCover) bossCoverEntries += 1;
      wasOuter = zone.outer;
      wasNearCover = zone.nearCover;
      if (previousBossPosition) {
        bossTravelDistance += Math.hypot(
          session.world.player.position.x - previousBossPosition.x,
          session.world.player.position.y - previousBossPosition.y,
        );
      }
      previousBossPosition = { ...session.world.player.position };
    }
    const result = session.step(input, 1 / FRAME_RATE);
    if (activeBossId) {
      bossRegularEnemiesKilled += result.events.filter(
        (event) => event.type === "enemy.killed" && event.enemyId !== activeBossId,
      ).length;
    }
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
  const bossDamageTaken = boss?.damageTakenDuringBoss ?? 0;
  const bossHpRecovered = boss?.hpRecoveredDuringBoss ?? 0;
  const result: ProbeResult = {
    sustainProfile: options.sustainProfile ?? "control",
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
    bossHealValueSupplied: boss?.healValueSuppliedDuringBoss ?? 0,
    bossHealDropsSuppressed: boss?.healDropsSuppressed ?? 0,
    bossHealDropsSuppressedCooldown:
      boss?.healDropsSuppressedByReason.cooldown ?? 0,
    bossHealDropsSuppressedBudget:
      boss?.healDropsSuppressedByReason["repair-budget-exhausted"] ?? 0,
    bossHealPickupsCollected: boss?.healPickupsCollected ?? 0,
    bossHealPickupsCollectedAtFullHp:
      boss?.healPickupsCollectedAtFullHp ?? 0,
    bossHealPickupsExpired: boss?.healPickupsExpired ?? 0,
    bossDamageTaken,
    bossHpRecovered,
    bossRepairOffsetRatio:
      bossDamageTaken > 0 ? bossHpRecovered / bossDamageTaken : null,
    bossRepairBudgetInitial: boss?.repairBudgetInitial ?? null,
    bossRepairBudgetSpent: boss?.repairBudgetSpent ?? 0,
    bossRepairBudgetRemaining: boss?.repairBudgetRemaining ?? null,
    bossHpRemaining: activeBoss?.hp ?? null,
    tacticalScore: expedition?.tacticalScore ?? 0,
    clearScoreBonus: expedition?.clearScoreBonus ?? 0,
    timeScoreBonus: expedition?.timeScoreBonus ?? 0,
    timeMedal: expedition?.timeMedal ?? null,
    bossFightDuration: expedition?.bossFightDuration ?? null,
    bossActiveFrames,
    bossAimFrames,
    bossCenterFrames,
    bossOuterFrames,
    bossCoverFrames,
    bossOuterEntries,
    bossCoverEntries,
    bossTravelDistance,
    bossRegularEnemiesKilled,
    commanderSpawned: commander?.spawned ?? 0,
    commanderKilled: commander?.killed ?? 0,
    lastDamageSource: session.world.stats.lastDamageSource,
    maximumEnemies,
    maximumProjectiles,
    maximumPickups,
    inputFrames: inputTape.length,
    inputTapeExhausted,
    inputHash: stableHash(JSON.stringify(inputTape)),
    eventHash: stableHash(JSON.stringify(eventDigest)),
    worldHash: stableHash(JSON.stringify(session.world)),
  };
  return { result, inputTape };
}

function createCenterOrbitInput(
  session: ArenaSession,
  bossPosition: { x: number; y: number },
  baseInput: InputSnapshot,
): InputSnapshot {
  const center = {
    x: session.config.arena.width / 2,
    y: session.config.arena.height / 2,
  };
  const bossSpawnedAt = session.world.expedition?.boss?.spawnedAt ?? 0;
  const angle = (session.world.state.elapsed - bossSpawnedAt) * 1.15;
  const target = {
    x: center.x + Math.cos(angle) * 120,
    y: center.y + Math.sin(angle) * 120,
  };
  const dx = target.x - session.world.player.position.x;
  const dy = target.y - session.world.player.position.y;
  const distance = Math.hypot(dx, dy);
  return {
    ...baseInput,
    move: distance > 8 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 },
    aimWorld: { ...bossPosition },
    shootHeld: true,
  };
}

function classifyBossPosition(session: ArenaSession): {
  center: boolean;
  outer: boolean;
  nearCover: boolean;
} {
  const player = session.world.player;
  const arena = session.config.arena;
  const centerDistance = Math.hypot(
    player.position.x - arena.width / 2,
    player.position.y - arena.height / 2,
  );
  const boundaryDistance = Math.min(
    player.position.x,
    arena.width - player.position.x,
    player.position.y,
    arena.height - player.position.y,
  );
  const nearCover = session.config.obstacles.some((obstacle) => {
    const nearestX = Math.max(obstacle.x, Math.min(player.position.x, obstacle.x + obstacle.width));
    const nearestY = Math.max(obstacle.y, Math.min(player.position.y, obstacle.y + obstacle.height));
    return Math.hypot(
      player.position.x - nearestX,
      player.position.y - nearestY,
    ) <= player.radius + 56;
  });
  return {
    center: centerDistance <= 200,
    outer: boundaryDistance <= 96,
    nearCover,
  };
}

function cloneInput(input: InputSnapshot): InputSnapshot {
  return {
    ...input,
    move: { ...input.move },
    aimWorld: input.aimWorld ? { ...input.aimWorld } : null,
  };
}

function expectedTimeMedal(
  elapsed: number,
): "gold" | "silver" | "bronze" | null {
  if (elapsed <= 540) return "gold";
  if (elapsed <= 600) return "silver";
  if (elapsed <= 720) return "bronze";
  return null;
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
