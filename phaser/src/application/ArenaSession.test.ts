import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { InputSnapshot } from "../domain/types";
import {
  createRandomStreams,
  RANDOM_STREAM_IDS,
  type RandomStreamId,
} from "../math/random";
import { createWorld } from "../simulation/createWorld";
import { projectLegacyWorldForDigest } from "../simulation/legacyWorldProjection";
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
  tutorialContinuePressed: false,
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
    const eventDigest: string[] = [];

    for (let index = 0; index < 180; index += 1) {
      const directResult = stepWorld(directWorld, input, 1 / 60, directRandom, config);
      const sessionResult = session.step(input, 1 / 60);
      expect(sessionResult).toEqual(directResult);
      eventDigest.push(...sessionResult.events.map((event) => JSON.stringify(event)));
    }

    expect(session.world).toEqual(directWorld);
    expect(session.randomStreams.seeds).toEqual(directRandom.seeds);
    expect(session.modeId).toBe("endless");
    expect(session.stageId).toBe("arena-default");
    expect(stableHash(JSON.stringify(eventDigest))).toBe("0e5c664a");
    expect(
      stableHash(
        JSON.stringify(projectLegacyWorldForDigest(session.world)),
      ),
    ).toBe("9e021e02");
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
    expect(session.config.leveling.extra).toMatchObject({
      baseXp: 180,
      growth: 1.04,
      maxXp: 360,
    });
  });

  it("retires the Endless contract only in the EX candidate profile", () => {
    const legacy = new ArenaSession(SIMULATION_CONFIG);
    legacy.start({ seed: 1, weaponType: "pulse" });
    expect(legacy.config.features.endlessContract).toBe(true);

    const candidate = new ArenaSession(SIMULATION_CONFIG);
    candidate.start({
      seed: 1,
      weaponType: "pulse",
      rulesetProfileId: "candidate-ex-endless-c2",
    });
    expect(candidate.config.features).toMatchObject({
      exProtocols: true,
      endlessContract: false,
    });
  });

  it("starts the final expedition with isolated runtime features and progress state", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260717,
      weaponType: "pulse",
      modeId: "expedition",
      stageId: "final-expedition",
    });

    expect(session.modeId).toBe("expedition");
    expect(session.stage).toMatchObject({
      id: "final-expedition",
      campaign: { order: 10, role: "final" },
      bossId: "final-command-ship",
      clearCondition: { type: "bossDefeat", bossId: "final-command-ship" },
    });
    expect(session.config.features).toMatchObject({
      encounterDeck: false,
      endlessContract: false,
      arenaCollapse: false,
    });
    expect(session.config.waves).toMatchObject([
      {
        start: 0,
        maxEnemies: 24,
        enemyWeights: { chaser: 1 },
      },
      {
        start: 75,
        enemyWeights: { chaser: 1, brute: 0.55 },
      },
      {
        start: 180,
        enemyWeights: { chaser: 0.9, brute: 0.6, fast: 0.75 },
      },
      {
        start: 300,
        enemyWeights: {
          chaser: 0.85,
          brute: 0.65,
          fast: 0.95,
          ranged: 0.55,
        },
      },
      {
        start: 390,
        maxEnemies: 64,
        enemyWeights: {
          chaser: 0.75,
          brute: 0.8,
          fast: 1.15,
          ranged: 0.9,
        },
      },
    ]);
    expect(session.config.threat).toMatchObject({
      pressureStartAt: 390,
      statStartAt: 450,
    });
    expect(session.config.leveling.extra).toMatchObject({
      baseXp: 180,
      growth: 1.12,
      maxXp: 900,
    });
    expect(session.config.enemies).toMatchObject({
      chaser: { xpValue: 2, score: 15 },
      brute: { hp: 8, xpValue: 6, score: 45 },
    });
    expect(session.config.pickup.healDropChance).toBeCloseTo(0.108);
    expect(session.world.expedition).toMatchObject({
      status: "active",
      actId: "perimeter-watch",
      objective: "四方から侵入する先遣隊を迎撃する",
      boss: null,
    });

    const result = session.step({ ...input, shootHeld: false }, 0);
    expect(result.events).toContainEqual({
      type: "expedition.act.changed",
      actId: "perimeter-watch",
      titleKey: "act.perimeter-watch.title",
      elapsed: 0,
    });
    expect(session.world.stats.encounterMetrics.expedition).toMatchObject({
      reachedActId: "perimeter-watch",
      actChanges: 1,
    });
  });

  it("starts deterministic basic training without normal spawns or records", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260720,
      weaponType: "pulse",
      modeId: "training",
      stageId: "basic-training",
    });

    expect(session.runtimeKind).toBe("training");
    expect(session.recordPolicy).toBe("none");
    expect(session.tutorialSnapshot).toMatchObject({
      stepId: "move",
      phase: "briefing",
      stepNumber: 1,
      stepCount: 9,
    });
    expect(session.world.state).toMatchObject({
      status: "trainingBriefing",
      weaponType: "pulse",
      hp: 100,
    });
    expect(session.config.waves[0]).toMatchObject({ maxEnemies: 0 });
    expect(session.config.pickup).toMatchObject({
      healDropChance: 0,
      healDropPityBonus: 0,
      healDropMaxChance: 0,
    });

    const briefingPosition = { ...session.world.player.position };
    for (let index = 0; index < 120; index += 1) {
      session.step({ ...input, shootHeld: false }, 1 / 60);
    }
    expect(session.world.state.elapsed).toBe(0);
    expect(session.world.player.position).toEqual(briefingPosition);
    expect(session.world.enemies).toEqual([]);
    expect(session.tutorialSnapshot).toMatchObject({
      stepId: "move",
      phase: "briefing",
    });

    session.step(
      {
        ...input,
        move: { x: 0, y: 0 },
        shootHeld: false,
        tutorialContinuePressed: true,
      },
      1 / 60,
    );
    expect(session.world.state.status).toBe("playing");
    expect(session.tutorialSnapshot?.phase).toBe("active");
  });

  it("starts Practice with fixed difficulty and only the selected enemies", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260724,
      weaponType: "spread",
      modeId: "practice",
      stageId: "practice-arena",
      practiceOptions: {
        invincible: true,
        intensity: "busy",
        enemyTypeIds: ["fast", "ranged"],
      },
    });

    expect(session.runtimeKind).toBe("practice");
    expect(session.recordPolicy).toBe("none");
    expect(session.rulesetProfile).toMatchObject({
      id: "practice-sandbox-v08",
      rankPolicy: "none",
    });
    expect(session.world.practice).toEqual({
      options: {
        invincible: true,
        intensity: "busy",
        enemyTypeIds: ["fast", "ranged"],
      },
    });
    expect(session.config.features).toMatchObject({
      exProtocols: false,
      encounterDeck: false,
      endlessContract: false,
      arenaCollapse: false,
    });
    expect(session.config.waves).toEqual([
      {
        start: 0,
        spawnInterval: 0.6,
        speedMultiplier: 0.95,
        maxEnemies: 20,
        spawnBudget: 3,
        enemyWeights: { fast: 0.9, ranged: 0.55 },
      },
    ]);
    expect(session.config.enemies).toMatchObject({
      chaser: { spawnCost: 1 },
      brute: { spawnCost: 1 },
      fast: { spawnCost: 1 },
      ranged: { spawnCost: 1 },
    });
    expect(session.config.threat).toMatchObject({
      pressureStartAt: Number.MAX_SAFE_INTEGER,
      statStartAt: Number.MAX_SAFE_INTEGER,
    });
    expect(session.tutorialSnapshot).toBeNull();
  });

  it("can spawn a high-cost enemy by itself at relaxed Practice intensity", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260724,
      weaponType: "pulse",
      modeId: "practice",
      stageId: "practice-arena",
      practiceOptions: {
        invincible: true,
        intensity: "relaxed",
        enemyTypeIds: ["brute"],
      },
    });

    for (let index = 0; index < 120; index += 1) {
      session.step({ ...input, shootHeld: false }, 1 / 60);
    }

    expect(session.world.enemies.length).toBeGreaterThan(0);
    expect(session.world.enemies.every((enemy) => enemy.typeId === "brute")).toBe(
      true,
    );
  });

  it("applies Practice options to the active run and future spawns", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260724,
      weaponType: "pulse",
      modeId: "practice",
      stageId: "practice-arena",
    });

    session.updatePracticeOptions({
      invincible: false,
      intensity: "standard",
      enemyTypeIds: ["fast", "ranged"],
    });

    expect(session.world.practice?.options).toEqual({
      invincible: false,
      intensity: "standard",
      enemyTypeIds: ["fast", "ranged"],
    });
    expect(session.config.waves).toEqual([
      {
        start: 0,
        spawnInterval: 0.9,
        speedMultiplier: 0.85,
        maxEnemies: 12,
        spawnBudget: 2,
        enemyWeights: { fast: 0.9, ranged: 0.55 },
      },
    ]);
  });

  it("replays Training events and world state deterministically", () => {
    const left = new ArenaSession(SIMULATION_CONFIG);
    const right = new ArenaSession(SIMULATION_CONFIG);
    const start = {
      seed: 20260720,
      weaponType: "pulse" as const,
      modeId: "training",
      stageId: "basic-training",
    };
    left.start(start);
    right.start(start);
    const leftEvents: string[] = [];
    const rightEvents: string[] = [];
    const confirmInput = {
      ...input,
      move: { x: 0, y: 0 },
      shootHeld: false,
      tutorialContinuePressed: true,
    };
    leftEvents.push(
      ...left.step(confirmInput, 1 / 60).events.map((event) => JSON.stringify(event)),
    );
    rightEvents.push(
      ...right.step(confirmInput, 1 / 60).events.map((event) => JSON.stringify(event)),
    );

    for (let index = 0; index < 240; index += 1) {
      const replayInput = {
        ...input,
        move: index < 90 ? { x: -1, y: -1 } : { x: 0, y: 0 },
        shootHeld: false,
      };
      leftEvents.push(
        ...left.step(replayInput, 1 / 60).events.map((event) => JSON.stringify(event)),
      );
      rightEvents.push(
        ...right.step(replayInput, 1 / 60).events.map((event) => JSON.stringify(event)),
      );
    }

    expect(rightEvents).toEqual(leftEvents);
    expect(right.world).toEqual(left.world);
    expect(right.tutorialSnapshot).toEqual(left.tutorialSnapshot);
  });

  it("does not consume random streams while restoring a Training checkpoint", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260720,
      weaponType: "pulse",
      modeId: "training",
      stageId: "basic-training",
    });
    const calls = Object.fromEntries(
      RANDOM_STREAM_IDS.map((streamId) => [streamId, 0]),
    ) as Record<RandomStreamId, number>;
    for (const streamId of RANDOM_STREAM_IDS) {
      const source = session.randomStreams[streamId];
      session.randomStreams[streamId] = () => {
        calls[streamId] += 1;
        return source();
      };
    }

    session.step(
      {
        ...input,
        move: { x: 0, y: 0 },
        shootHeld: false,
        tutorialContinuePressed: true,
      },
      1 / 60,
    );

    for (let index = 0; index < 120; index += 1) {
      session.step(
        { ...input, move: { x: 0, y: 0 }, shootHeld: false },
        1 / 60,
      );
    }
    session.world.state.hp = 0;
    const retried = session.step(
      { ...input, move: { x: 0, y: 0 }, shootHeld: false },
      1 / 60,
    );

    expect(retried.events).toContainEqual({
      type: "tutorial.step.retried",
      stepId: "move",
      retryCount: 1,
      reason: "damage",
    });
    expect(session.tutorialSnapshot).toMatchObject({
      stepId: "move",
      retryCount: 1,
    });
    expect(calls).toEqual({
      spawn: 0,
      upgrade: 0,
      drop: 0,
      encounter: 0,
      stageVariant: 0,
    });
  });

  it("opens pause controls from a Training upgrade selection without changing normal rules", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260720,
      weaponType: "pulse",
      modeId: "training",
      stageId: "basic-training",
    });
    session.world.state.status = "upgradeSelect";
    session.world.progression.pendingUpgradeChoices = ["rapidFire"];

    const paused = session.step(
      { ...input, pausePressed: true, upgradeChoicePressed: 0 },
      1 / 60,
    );

    expect(paused.events).toContainEqual({
      type: "game.paused",
      elapsed: 0,
    });
    expect(session.world.state.status).toBe("paused");
    expect(session.world.progression.pendingUpgradeChoices).toEqual([
      "rapidFire",
    ]);
    expect(session.world.progression.upgradeRanks.rapidFire).toBe(0);
  });

  it("requires an active run before exposing state", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    expect(() => session.world).toThrow("ArenaSession has not been started.");
  });
});

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
