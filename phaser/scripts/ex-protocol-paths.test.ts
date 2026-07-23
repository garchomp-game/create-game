import { describe, expect, it } from "vitest";
import { ArenaSession } from "../src/application/ArenaSession";
import {
  createRankEligibility,
  createRunRecord,
} from "../src/application/runRecords";
import {
  EX_PROTOCOL_CATALOG,
  type ExProtocolCatalog,
  type ExProtocolDefinition,
} from "../src/content/exProtocolCatalog";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import {
  EX_PROTOCOL_CANDIDATE_APP_VERSION,
} from "../src/config/version";
import type {
  Enemy,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../src/domain/types";
import { createArenaRunExport } from "../src/adapters/telemetry/ArenaRunExport";
import { createRunResultSummary } from "../src/simulation/resultSummary";
import {
  chooseExProtocol,
  chooseExProtocolEvolution,
} from "../src/simulation/exProtocolProgression";
import {
  completeBuild,
  updateLevelProgression,
} from "../src/simulation/systems/levelSystem";
import { getPlayerCapacity } from "../src/simulation/systems/playerHealthSystem";
import { chooseUpgrade } from "../src/simulation/systems/upgradeSystem";
import {
  recordExProtocolEvent,
  refreshExProtocolExposureStats,
} from "../src/simulation/systems/exProtocolStatsSystem";
import { updateShooting } from "../src/simulation/systems/shootingSystem";
import { resolveCombat } from "../src/simulation/systems/combatSystem";
import { updateBullets } from "../src/simulation/systems/bulletSystem";
import {
  updateReboundLifecycle,
} from "../src/simulation/protocols/reboundOverdrive";
import {
  getRedlineFocusDurationBonus,
} from "../src/simulation/protocols/redlineCore";
import {
  activateTidalSweep,
  recordTidalActivationHit,
  recordTidalNormalHit,
} from "../src/simulation/protocols/tidalSweep";
import {
  activateBreakwaterFan,
  getBreakwaterMovementMultiplier,
} from "../src/simulation/protocols/breakwaterFan";
import {
  getAegisInterceptionRadiusBonus,
  getAegisMovementMultiplier,
  recordAegisInterception,
  shouldAegisProjectileSurviveIntercept,
} from "../src/simulation/protocols/aegisFan";

const PATHS = EX_PROTOCOL_CATALOG.protocols.flatMap(
  (protocol, protocolIndex) =>
    protocol.evolutionOne.flatMap((evolutionOne, evolutionOneIndex) =>
      protocol.evolutionTwo.map((evolutionTwo, evolutionTwoIndex) => ({
        id:
          `${protocol.id}/${evolutionOne.id}/${evolutionTwo.id}`,
        protocol,
        protocolIndex:
          protocolIndex % 3,
        evolutionOneIndex,
        evolutionTwoIndex,
      }))
    ),
);

type RelayDefinition = ExProtocolCatalog["protocols"][0];
type ReboundDefinition = ExProtocolCatalog["protocols"][1];
type RedlineDefinition = ExProtocolCatalog["protocols"][2];
type TidalDefinition = ExProtocolCatalog["protocols"][3];
type BreakwaterDefinition = ExProtocolCatalog["protocols"][4];
type AegisDefinition = ExProtocolCatalog["protocols"][5];

describe("EX Protocol path matrix", () => {
  it("generates exactly 24 unique paths from the closed catalog", () => {
    expect(PATHS).toHaveLength(24);
    expect(new Set(PATHS.map(({ id }) => id)).size).toBe(24);
    expect(
      PATHS.filter(({ protocol }) => protocol.weaponId === "pulse"),
    ).toHaveLength(12);
    expect(
      PATHS.filter(({ protocol }) => protocol.weaponId === "spread"),
    ).toHaveLength(12);
  });

  it.each(PATHS)(
    "$id executes mechanic, Limit Break, record, and export",
    ({
      id,
      protocol,
      protocolIndex,
      evolutionOneIndex,
      evolutionTwoIndex,
    }) => {
      const session = createCandidateSession(protocol.weaponId);
      const { world, config } = session;
      completeNormalBuild(world, config);
      world.state.elapsed = 120;

      captureEvents(world, (events) =>
        completeBuild(world, config, events));
      captureEvents(world, (events) => {
        expect(
          chooseExProtocol(
            world,
            protocolIndex,
            config,
            events,
          ),
        ).toBe(true);
      });
      expectSelectedRoute(world, protocol.id, null, null);
      expect(world.progression.extraLevel).toBe(0);

      world.state.elapsed = 130;
      advanceExLevel(session);
      captureEvents(world, (events) => {
        expect(
          chooseExProtocolEvolution(
            world,
            evolutionOneIndex,
            config,
            events,
          ),
        ).toBe(true);
      });

      world.state.elapsed = 140;
      advanceExLevel(session);
      captureEvents(world, (events) => {
        expect(
          chooseExProtocolEvolution(
            world,
            evolutionTwoIndex,
            config,
            events,
          ),
        ).toBe(true);
      });
      const evolutionOne =
        protocol.evolutionOne[evolutionOneIndex]!;
      const evolutionTwo =
        protocol.evolutionTwo[evolutionTwoIndex]!;
      expectSelectedRoute(
        world,
        protocol.id,
        evolutionOne.id,
        evolutionTwo.id,
      );

      world.state.elapsed = 150;
      advanceExLevel(session);
      expect(world.progression.extraLevel).toBe(3);
      expect(world.progression.pendingChoice?.kind).toBe(
        "limit-break",
      );
      const routeBeforeLimitBreak = getSelectedRoute(world);
      captureEvents(world, (events) => {
        chooseUpgrade(world, 0, config, events);
      });
      expect(world.state.status).toBe("playing");
      expect(getSelectedRoute(world)).toEqual(routeBeforeLimitBreak);

      world.state.elapsed = 180;
      exerciseProtocolMechanic(world, config, protocol);
      refreshExProtocolExposureStats(world);

      const context = {
        id: `path-${id}`,
        profileId: "path-probe",
        startedAt: "2026-07-23T00:00:00.000Z",
        modeId: "endless",
        stageId: "arena-default",
        difficultyId: "standard",
        rulesetVersion: session.rulesetProfile.rulesetVersion,
        seedCategory: "fixed" as const,
        weaponId: protocol.weaponId,
        modifierIds: [],
        appVersion: EX_PROTOCOL_CANDIDATE_APP_VERSION,
        buildCommit: "path-probe",
        seed: session.seed,
        runOrigin: "test" as const,
        rankEligibility: createRankEligibility("test", true),
        rulesetProfileId: session.rulesetProfile.id,
        rngVersion: session.rulesetProfile.randomStreamVersion,
        runRecordSchemaVersion: 3 as const,
        exProtocolsEnabled: true,
      };
      const record = createRunRecord({
        context,
        capturedAt: "2026-07-23T00:03:00.000Z",
        summary: createRunResultSummary(world, config),
        upgradeRanks: world.progression.upgradeRanks,
        upgradeSelections: [],
        extraUpgradeRanks: world.progression.extraUpgradeRanks,
        extraUpgradeSelections: [],
        buildCompletedAt: world.progression.buildCompletedAt,
        exProtocolMetrics: world.stats.exProtocolMetrics,
      });
      expect(record).toMatchObject({
        schemaVersion: 3,
        exProtocol: {
          selectedId: protocol.id,
          evolutionOneId: evolutionOne.id,
          evolutionTwoId: evolutionTwo.id,
          masteryId: protocol.mastery.id,
          firstLimitBreakAtElapsed: 150,
        },
      });

      const runExport = createArenaRunExport({
        capturedAt: "2026-07-23T00:03:00.000Z",
        buildCommit: "path-probe",
        context,
        profileId: "path-probe",
        baseRunOrigin: "test",
        fixedSeed: session.seed,
        runSeed: session.seed,
        randomStreams: session.randomStreams,
        runConfig: config,
        world,
        performance: {
          frameSamples: 0,
          averageRawDtMs: 0,
          p95RawDtMs: 0,
          maxRawDtMs: 0,
          framesOver50Ms: 0,
          estimatedFps: 0,
          actualFps: 0,
        },
        renderPerformance: {
          staticBackground: {
            drawCount: 0,
            drawDurationMs: 0,
          },
          renderedFrames: 0,
          dynamicWorld: { averageMs: 0, maxMs: 0 },
          screenHud: { averageMs: 0, maxMs: 0 },
          feedback: { averageMs: 0, maxMs: 0 },
        },
        lastEvents: [],
      });
      expect(
        JSON.parse(JSON.stringify(runExport.exProtocol)),
      ).toMatchObject({
        selectedId: protocol.id,
        evolutionOneId: evolutionOne.id,
        evolutionTwoId: evolutionTwo.id,
        masteryId: protocol.mastery.id,
        limitBreakFirstAtElapsed: 150,
      });
    },
  );
});

function createCandidateSession(
  weaponId: "pulse" | "spread",
): ArenaSession & {
  randomStreams: Extract<
    ArenaSession["randomStreams"],
    { version: "arena-rng-v2" }
  >;
} {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260723,
    weaponType: weaponId,
    rulesetProfileId: "candidate-ex-endless-c1",
  });
  if (session.randomStreams.version !== "arena-rng-v2") {
    throw new Error("Candidate path must use RNG v2.");
  }
  return session as ArenaSession & {
    randomStreams: Extract<
      ArenaSession["randomStreams"],
      { version: "arena-rng-v2" }
    >;
  };
}

function completeNormalBuild(
  world: WorldState,
  config: SimulationConfig,
): void {
  for (const upgradeId of Object.keys(
    world.progression.upgradeRanks,
  ) as Array<keyof typeof world.progression.upgradeRanks>) {
    const requirements = config.upgrades[upgradeId].requirements;
    if (
      requirements?.weaponIds &&
      !requirements.weaponIds.includes(world.state.weaponType)
    ) {
      continue;
    }
    world.progression.upgradeRanks[upgradeId] =
      config.upgrades[upgradeId].maxRank;
  }
}

function advanceExLevel(
  session: ArenaSession & {
    randomStreams: Extract<
      ArenaSession["randomStreams"],
      { version: "arena-rng-v2" }
    >;
  },
): void {
  session.world.progression.xp =
    session.world.progression.xpToNext;
  captureEvents(session.world, (events) =>
    updateLevelProgression(
      session.world,
      session.randomStreams.upgrade,
      session.config,
      events,
    ));
}

function captureEvents(
  world: WorldState,
  operation: (events: GameEvent[]) => void,
): GameEvent[] {
  const events: GameEvent[] = [];
  operation(events);
  for (const event of events) recordExProtocolEvent(world, event);
  return events;
}

function expectSelectedRoute(
  world: WorldState,
  protocolId: string,
  evolutionOneId: string | null,
  evolutionTwoId: string | null,
): void {
  expect(getSelectedRoute(world)).toMatchObject({
    protocolId,
    evolutionOneId,
    evolutionTwoId,
    masteryUnlocked: evolutionTwoId !== null,
  });
}

function getSelectedRoute(world: WorldState) {
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") {
    throw new Error("Expected a selected EX Protocol route.");
  }
  return structuredClone(progression.route);
}

function exerciseProtocolMechanic(
  world: WorldState,
  config: SimulationConfig,
  protocol: ExProtocolDefinition,
): void {
  world.obstacles = [];
  world.bullets = [];
  world.enemies = [];
  world.enemyProjectiles = [];
  world.analytics.activeVolleys = {};
  world.state.shotTimer = 0;
  world.runtime.projectileSpeedMultiplier = 1;
  world.runtime.projectileDamageMultiplier = 1;
  world.runtime.projectileCountBonus = 0;
  world.runtime.hitCapacityBonus = 0;
  world.runtime.ricochetBonus = 0;
  world.runtime.pulseFocusBonusPerStack = 0;
  world.runtime.pulseLineBonusPerStack = 0;
  if (protocol.id === "pulse.resonance-relay") {
    exerciseResonance(
      world,
      config,
      protocol as RelayDefinition,
    );
  } else if (protocol.id === "pulse.rebound-overdrive") {
    exerciseRebound(
      world,
      config,
      protocol as ReboundDefinition,
    );
  } else if (protocol.id === "pulse.redline-core") {
    exerciseRedline(
      world,
      config,
      protocol as RedlineDefinition,
    );
  } else if (protocol.id === "spread.full-span-tidal-sweep") {
    exerciseTidal(world, config, protocol as TidalDefinition);
  } else if (protocol.id === "spread.breakwater-fan") {
    exerciseBreakwater(
      world,
      config,
      protocol as BreakwaterDefinition,
    );
  } else if (protocol.id === "spread.aegis-fan") {
    exerciseAegis(world, config, protocol as AegisDefinition);
  } else {
    throw new Error(`No path mechanic fixture for "${protocol.id}".`);
  }
}

function exerciseResonance(
  world: WorldState,
  config: SimulationConfig,
  protocol: RelayDefinition,
): void {
  world.player.position = { x: 100, y: 270 };
  world.state.lastAim = { x: 1, y: 0 };
  world.runtime.pulseFocusMaxStacks = 3;
  const anchorEvents = captureEvents(world, (events) =>
    updateShooting(world, true, config, events));
  const anchorBullet = world.bullets[0]!;
  const anchor = createEnemy(
    world,
    "path-anchor",
    anchorBullet.position.x,
    270,
    100,
    1,
  );
  anchor.pulseFocusStacks = 2;
  anchor.pulseFocusExpiresAt = 999;
  world.enemies = [anchor];
  captureEvents(world, (events) =>
    resolveCombat(world, config, events));
  const runtime = requireRuntime(world, "resonance-relay");
  const extended = protocol.evolutionOne[0];
  const expectedLifetime =
    getSelectedRoute(world).evolutionOneId === extended.id
      ? extended.anchorLifetimeSeconds
      : protocol.signature.anchorLifetimeSeconds;
  expect(runtime.anchor?.expiresAt).toBeCloseTo(
    world.state.elapsed + expectedLifetime,
  );
  expect(anchorEvents.some(({ type }) => type === "shot.fired")).toBe(
    true,
  );

  world.bullets = [];
  world.analytics.activeVolleys = {};
  world.player.position = { x: 800, y: 270 };
  world.state.lastAim = { x: -1, y: 0 };
  world.state.shotTimer = 0;
  captureEvents(world, (events) =>
    updateShooting(world, true, config, events));
  const endpointBullet = world.bullets[0]!;
  const endpoint = createEnemy(
    world,
    "path-endpoint",
    endpointBullet.position.x,
    270,
    100,
    10,
  );
  const intermediates = Array.from({ length: 5 }, (_, index) =>
    createEnemy(
      world,
      `path-relay-${index}`,
      220 + index * 90,
      270,
      100,
      index + 2,
    ));
  world.enemies = [anchor, endpoint, ...intermediates];
  const relayEvents = captureEvents(world, (events) =>
    resolveCombat(world, config, events));
  const dense = protocol.evolutionOne[1];
  const expectedTargets =
    getSelectedRoute(world).evolutionOneId === dense.id
      ? dense.maxIntermediateTargets
      : protocol.signature.maxIntermediateTargets;
  expect(relayEvents).toContainEqual(
    expect.objectContaining({
      type: "ex.relay.resolved",
      targetCount: expectedTargets,
    }),
  );
  const residual = protocol.evolutionTwo[0];
  const endpointPriming = protocol.evolutionTwo[1];
  expect(anchor.pulseFocusStacks).toBe(
    getSelectedRoute(world).evolutionTwoId === residual.id
      ? residual.remainingAnchorFocusStacks
      : protocol.signature.resetAnchorFocusStacks,
  );
  if (
    getSelectedRoute(world).evolutionTwoId === endpointPriming.id
  ) {
    expect(endpoint.pulseFocusStacks).toBe(
      world.runtime.pulseFocusMaxStacks,
    );
    expect(runtime.anchor?.enemyId).toBe(endpoint.id);
  } else {
    expect(endpoint.pulseFocusStacks).toBe(1);
    expect(runtime.anchor).toBeNull();
  }
  expect(intermediates[0]!.hp).toBeCloseTo(
    100 -
      config.weapons.pulse.damage *
        protocol.mastery.damageMultiplier,
  );
}

function exerciseRebound(
  world: WorldState,
  config: SimulationConfig,
  protocol: ReboundDefinition,
): void {
  world.player.position = { x: 910, y: 270 };
  world.state.lastAim = { x: 1, y: 0 };
  world.runtime.hitCapacityBonus = 2;
  world.runtime.ricochetBonus = 1;
  captureEvents(world, (events) =>
    updateReboundLifecycle(world, true, events));
  const runtime = requireRuntime(world, "rebound-overdrive");
  const rapid = protocol.evolutionOne[0];
  expect(runtime.cooldownUntil - world.state.elapsed).toBe(
    getSelectedRoute(world).evolutionOneId === rapid.id
      ? rapid.cooldownSeconds
      : protocol.signature.cooldownSeconds,
  );
  captureEvents(world, (events) =>
    updateShooting(world, true, config, events));
  const bullet = world.bullets[0]!;
  const doubleReflection = protocol.evolutionTwo[0];
  expect(bullet.ricochetRemaining).toBe(
    world.runtime.ricochetBonus +
      (getSelectedRoute(world).evolutionTwoId ===
          doubleReflection.id
        ? doubleReflection.armedVolleyRicochetCapacityBonus
        : 0),
  );
  world.enemies = [
    createEnemy(world, "path-rebound-out", 945, 270, 100, 1),
  ];
  captureEvents(world, (events) =>
    resolveCombat(
      world,
      config,
      events,
      updateBullets(world, 0.05, config),
    ));
  const deepReturn = protocol.evolutionOne[1];
  expect(bullet.hitsRemaining).toBe(
    bullet.candidate!.hitCapacityAtFire +
      (getSelectedRoute(world).evolutionOneId === deepReturn.id
        ? deepReturn.capacityBonus
        : protocol.signature.capacityBonus),
  );

  world.enemies = Array.from({ length: 3 }, (_, index) =>
    createEnemy(
      world,
      `path-rebound-return-${index}`,
      950 - index * 10,
      270,
      100,
      index + 2,
    ));
  const returnEvents = captureEvents(world, (events) =>
    resolveCombat(
      world,
      config,
      events,
      updateBullets(world, 0.05, config),
    ));
  const returnSurge = protocol.evolutionTwo[1];
  const expectedDamage =
    config.weapons.pulse.damage *
    (getSelectedRoute(world).evolutionTwoId === returnSurge.id
      ? returnSurge.postRicochetDamageMultiplier
      : 1);
  const returnHits = returnEvents.filter(
    (
      event,
    ): event is Extract<GameEvent, { type: "enemy.hit" }> =>
      event.type === "enemy.hit" &&
      event.enemyId.startsWith("path-rebound-return"),
  );
  expect(returnHits).toHaveLength(3);
  expect(returnHits[0]!.damage).toBeCloseTo(expectedDamage);
  expect(returnEvents).toContainEqual(
    expect.objectContaining({
      type: "ex.rebound.cooldown.refunded",
    }),
  );
}

function exerciseRedline(
  world: WorldState,
  config: SimulationConfig,
  protocol: RedlineDefinition,
): void {
  const stabilized = protocol.evolutionOne[0];
  const capacity = getPlayerCapacity(world, config);
  const expectedCapacityMultiplier =
    getSelectedRoute(world).evolutionOneId === stabilized.id
      ? stabilized.effectiveMaxHpMultiplier
      : protocol.signature.effectiveMaxHpMultiplier;
  expect(capacity.effectiveMaxHp).toBe(
    Math.max(
      1,
      Math.floor(capacity.grossMaxHp * expectedCapacityMultiplier),
    ),
  );
  expect(capacity.reservedHp).toBe(
    capacity.grossMaxHp - capacity.effectiveMaxHp,
  );
  world.player.position = { x: 100, y: 270 };
  world.state.lastAim = { x: 1, y: 0 };
  world.runtime.pulseFocusMaxStacks = 3;
  captureEvents(world, (events) =>
    updateShooting(world, true, config, events));
  const bullet = world.bullets[0]!;
  const trigger = createEnemy(
    world,
    "path-redline-trigger",
    bullet.position.x,
    bullet.position.y,
    100,
    1,
  );
  trigger.pulseFocusStacks = 3;
  trigger.pulseFocusExpiresAt = 999;
  world.enemies = [trigger];
  const triggerEvents = captureEvents(world, (events) =>
    resolveCombat(world, config, events));
  const overpressure = protocol.evolutionOne[1];
  const redlineMultiplier =
    getSelectedRoute(world).evolutionOneId === overpressure.id
      ? overpressure.redlineDamageMultiplier
      : protocol.signature.redlineDamageMultiplier;
  const redlineDamage =
    config.weapons.pulse.damage * redlineMultiplier;
  expect(triggerEvents).toContainEqual(
    expect.objectContaining({
      type: "ex.redline.hit",
      totalDamage: redlineDamage,
    }),
  );
  const deepBore = protocol.evolutionTwo[1];
  expect(bullet.hitsRemaining).toBe(
    getSelectedRoute(world).evolutionTwoId === deepBore.id
      ? deepBore.capacityRestore
      : protocol.signature.capacityRestore,
  );
  const longBurn = protocol.evolutionTwo[0];
  expect(getRedlineFocusDurationBonus(world)).toBe(
    getSelectedRoute(world).evolutionTwoId === longBurn.id
      ? longBurn.focusDurationBonusSeconds
      : 0,
  );
  const masteryTarget = createEnemy(
    world,
    "path-redline-mastery",
    bullet.position.x,
    bullet.position.y,
    100,
    2,
  );
  world.enemies = [masteryTarget];
  captureEvents(world, (events) =>
    resolveCombat(world, config, events));
  expect(masteryTarget.hp).toBeCloseTo(
    100 -
      redlineDamage *
        protocol.mastery.extraCapacityHitDamageMultiplier,
  );
}

function exerciseTidal(
  world: WorldState,
  config: SimulationConfig,
  protocol: TidalDefinition,
): void {
  const runtime = requireRuntime(
    world,
    "full-span-tidal-sweep",
  );
  runtime.charges = 1;
  world.state.lastAim = { x: 1, y: 0 };
  captureEvents(world, (events) =>
    activateTidalSweep(world, true, config, events));
  expect(world.bullets).toHaveLength(
    protocol.signature.projectileCount,
  );
  const firstDirection = normalized(world.bullets[0]!.velocity);
  const lastDirection = normalized(world.bullets.at(-1)!.velocity);
  const actualArc = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        firstDirection.x * lastDirection.x +
          firstDirection.y * lastDirection.y,
      ),
    ),
  );
  const wideWake = protocol.evolutionOne[0];
  expect(actualArc).toBeCloseTo(
    getSelectedRoute(world).evolutionOneId === wideWake.id
      ? wideWake.arcRadians
      : protocol.signature.arcRadians,
  );
  const deepWake = protocol.evolutionOne[1];
  const expectedCapacity =
    getSelectedRoute(world).evolutionOneId === deepWake.id
      ? deepWake.hitCapacity
      : protocol.signature.hitCapacity;
  expect(
    world.bullets.every(
      (bullet) => bullet.hitsRemaining === expectedCapacity,
    ),
  ).toBe(true);

  const activationBullet = world.bullets[0]!;
  world.state.shotTimer = 4;
  for (let index = 0; index < 5; index += 1) {
    captureEvents(world, (events) =>
      recordTidalActivationHit(
        world,
        activationBullet,
        createEnemy(
          world,
          `path-tidal-activation-${index}`,
          500,
          270,
          100,
          index + 1,
        ),
        events,
      ));
  }
  const backwash = protocol.evolutionTwo[1];
  expect(world.state.shotTimer).toBe(
    getSelectedRoute(world).evolutionTwoId === backwash.id
      ? 4 * backwash.currentNormalShotTimerMultiplier
      : 4,
  );
  expect(world.weaponIdentity.spreadSweepCharge).toBe(true);

  world.bullets = [];
  world.runtime.projectileCountBonus = 2;
  world.state.shotTimer = 0;
  captureEvents(world, (events) =>
    updateShooting(world, true, config, events));
  const chargeEvents: GameEvent[] = [];
  world.bullets.forEach((bullet, index) => {
    const events = captureEvents(world, (nextEvents) =>
      recordTidalNormalHit(
        world,
        bullet,
        createEnemy(
          world,
          `path-tidal-normal-${index}`,
          300 + index * 20,
          270,
          100,
          index + 10,
        ),
        nextEvents,
      ));
    chargeEvents.push(...events);
  });
  const doubleReservoir = protocol.evolutionTwo[0];
  expect(chargeEvents).toContainEqual(
    expect.objectContaining({
      type: "ex.tidal.charged",
      maxCharge:
        getSelectedRoute(world).evolutionTwoId ===
          doubleReservoir.id
          ? doubleReservoir.maxCharges
          : protocol.signature.maxCharges,
    }),
  );
}

function exerciseBreakwater(
  world: WorldState,
  config: SimulationConfig,
  protocol: BreakwaterDefinition,
): void {
  const runtime = requireRuntime(world, "breakwater-fan");
  runtime.charges = 1;
  world.player.position = { x: 480, y: 270 };
  world.state.lastAim = { x: 1, y: 0 };
  world.state.hp = 100;
  const common = Array.from({ length: 5 }, (_, index) =>
    createEnemy(
      world,
      `path-break-common-${index}`,
      580,
      230 + index * 20,
      100,
      index + 1,
    ));
  const far = createEnemy(
    world,
    "path-break-far",
    700,
    270,
    100,
    10,
  );
  const sideRadians = (65 * Math.PI) / 180;
  const side = createEnemy(
    world,
    "path-break-side",
    480 + Math.cos(sideRadians) * 170,
    270 + Math.sin(sideRadians) * 170,
    100,
    11,
  );
  world.enemies = [...common, far, side];
  const hpBefore = world.state.hp;
  captureEvents(world, (events) =>
    activateBreakwaterFan(world, true, config, events));
  const efficient = protocol.evolutionOne[0];
  const costRatio =
    getSelectedRoute(world).evolutionOneId === efficient.id
      ? efficient.costGrossHpSnapshotRatio
      : protocol.signature.costGrossHpSnapshotRatio;
  expect(hpBefore - world.state.hp).toBe(
    Math.ceil(runtime.grossMaxHpAtSelection * costRatio),
  );
  const hard = protocol.evolutionOne[1];
  const expectedCommonDamage =
    config.weapons.spread.damage *
    protocol.signature.damageMultipliers.chaser *
    (getSelectedRoute(world).evolutionOneId === hard.id
      ? hard.activationDamageMultiplier
      : 1);
  expect(common[0]!.hp).toBeCloseTo(100 - expectedCommonDamage);
  const longBreak = protocol.evolutionTwo[0];
  if (getSelectedRoute(world).evolutionTwoId === longBreak.id) {
    expect(far.hp).toBeLessThan(100);
    expect(side.hp).toBe(100);
  } else {
    expect(far.hp).toBe(100);
    expect(side.hp).toBeLessThan(100);
  }
  expect(getBreakwaterMovementMultiplier(world)).toBe(
    protocol.mastery.moveSpeedMultiplier,
  );
}

function exerciseAegis(
  world: WorldState,
  config: SimulationConfig,
  protocol: AegisDefinition,
): void {
  world.state.lastAim = { x: 1, y: 0 };
  captureEvents(world, (events) =>
    updateShooting(world, true, config, events));
  const left = world.bullets[0];
  const center =
    world.bullets[Math.floor(world.bullets.length / 2)];
  const right = world.bullets.at(-1);
  const restored = protocol.evolutionOne[0];
  const expectedEdgeMultiplier =
    getSelectedRoute(world).evolutionOneId === restored.id
      ? restored.edgeEnemyDamageMultiplier
      : protocol.signature.edgeEnemyDamageMultiplier;
  expect(left!.damage).toBeCloseTo(
    config.weapons.spread.damage * expectedEdgeMultiplier,
  );
  expect(center!.damage).toBe(config.weapons.spread.damage);
  expect(right!.damage).toBeCloseTo(
    config.weapons.spread.damage * expectedEdgeMultiplier,
  );
  const broad = protocol.evolutionOne[1];
  expect(getAegisInterceptionRadiusBonus(world)).toBe(
    getSelectedRoute(world).evolutionOneId === broad.id
      ? broad.interceptionRadiusBonusPx
      : 0,
  );
  const carry = protocol.evolutionTwo[0];
  expect(shouldAegisProjectileSurviveIntercept(world)).toBe(
    getSelectedRoute(world).evolutionTwoId === carry.id,
  );
  captureEvents(world, (events) =>
    recordAegisInterception(world, left!, events));
  captureEvents(world, (events) =>
    recordAegisInterception(world, right!, events));
  const runtime = requireRuntime(world, "aegis-fan");
  expect(runtime.perfectGuardCharges).toBe(1);
  const momentum = protocol.evolutionTwo[1];
  expect(getAegisMovementMultiplier(world)).toBe(
    getSelectedRoute(world).evolutionTwoId === momentum.id
      ? momentum.moveSpeedMultiplier
      : 1,
  );
  world.bullets = [];
  world.state.shotTimer = 0;
  const empoweredEvents = captureEvents(world, (events) =>
    updateShooting(world, true, config, events));
  expect(empoweredEvents).toContainEqual(
    expect.objectContaining({
      type: "ex.aegis.empowered.volley",
    }),
  );
  expect(world.bullets[0]!.damage).toBeCloseTo(
    config.weapons.spread.damage *
      protocol.mastery.nextVolleyEdgeEnemyDamageMultiplier,
  );
}

function createEnemy(
  world: WorldState,
  id: string,
  x: number,
  y: number,
  hp: number,
  creationOrdinal: number,
): Enemy {
  const definition = SIMULATION_CONFIG.enemies.chaser;
  return {
    id,
    typeId: "chaser",
    position: { x, y },
    radius: definition.radius,
    hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena: true,
    candidate: { creationOrdinal },
  };
}

function requireRuntime<
  TKind extends
    Extract<
      NonNullable<
        WorldState["progression"]["exProtocol"]
      >,
      { status: "selected" }
    >["runtime"]["kind"],
>(
  world: WorldState,
  kind: TKind,
): Extract<
  Extract<
    NonNullable<
      WorldState["progression"]["exProtocol"]
    >,
    { status: "selected" }
  >["runtime"],
  { kind: TKind }
> {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== kind
  ) {
    throw new Error(`Expected "${kind}" runtime.`);
  }
  return progression.runtime as Extract<
    typeof progression.runtime,
    { kind: TKind }
  >;
}

function normalized(vector: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= Number.EPSILON) return { x: 1, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}
