import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../../content/exProtocolCatalog";
import { createWorld } from "../createWorld";
import {
  recordExProtocolDamageOutcome,
} from "./exProtocolStatsSystem";
import { updateRunStats } from "./statsSystem";

describe("EX Protocol run telemetry", () => {
  it("tracks progression, active input, and exposure independently of lastEvents", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const protocolId = toExProtocolId("pulse.rebound-overdrive");
    const evolutionOneId = toExProtocolEvolutionId(
      protocolId,
      "evolutionOne",
      "rapid-chamber",
    );
    const evolutionTwoId = toExProtocolEvolutionId(
      protocolId,
      "evolutionTwo",
      "double-reflection",
    );

    updateRunStats(world, [
      {
        type: "ex.protocol.offered",
        weaponId: "pulse",
        exLevel: 0,
        choices: [protocolId],
        elapsed: 10,
      },
      {
        type: "ex.protocol.selected",
        weaponId: "pulse",
        protocolId,
        interaction: "active",
        exLevel: 0,
        elapsed: 10,
      },
      {
        type: "ex.evolution.offered",
        protocolId,
        tier: 1,
        exLevel: 1,
        choices: [evolutionOneId],
        elapsed: 20,
      },
      {
        type: "ex.evolution.selected",
        protocolId,
        tier: 1,
        evolutionId: evolutionOneId,
        exLevel: 1,
        elapsed: 20,
      },
      {
        type: "ex.evolution.selected",
        protocolId,
        tier: 2,
        evolutionId: evolutionTwoId,
        exLevel: 2,
        elapsed: 30,
      },
      {
        type: "ex.mastery.unlocked",
        protocolId,
        masteryId: "perfect-return",
        exLevel: 2,
        elapsed: 30,
      },
      {
        type: "ex.special.armed",
        protocolId,
        elapsed: 32,
      },
      {
        type: "ex.special.rejected",
        protocolId,
        reason: "cooldown",
        elapsed: 33,
      },
      {
        type: "ex.special.armed",
        protocolId,
        elapsed: 38,
      },
      {
        type: "ex.limit_break.connected",
        protocolId,
        exLevel: 3,
        elapsed: 40,
      },
    ]);
    world.state.elapsed = 50;
    updateRunStats(world, []);

    expect(world.stats.exProtocolMetrics).toMatchObject({
      offeredIds: [protocolId],
      selectedId: protocolId,
      selectedAtElapsed: 10,
      evolutionOneId,
      evolutionOneAtElapsed: 20,
      evolutionTwoId,
      evolutionTwoAtElapsed: 30,
      masteryId: "perfect-return",
      masteryAtElapsed: 30,
      limitBreakFirstAtElapsed: 40,
      specialPresses: 3,
      specialAccepted: 2,
      specialRejectedByReason: { cooldown: 1 },
      activeUseIntervalCount: 1,
      activeUseIntervalSumSeconds: 6,
      activeUseIntervalMaxSeconds: 6,
      counters: {
        protocolExposureSeconds: 40,
        evolutionOneExposureSeconds: 30,
        evolutionTwoExposureSeconds: 20,
        masteryExposureSeconds: 20,
        choiceCountProtocol: 1,
        choiceCountEvolution: 1,
        arms: 2,
      },
    });
  });

  it("keeps source, bonus, and finisher attribution mutually exclusive", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const protocolId = toExProtocolId("pulse.rebound-overdrive");
    world.stats.exProtocolMetrics.selectedId = protocolId;

    recordExProtocolDamageOutcome(world, {
      damage: 4,
      hpBefore: 4,
      killed: true,
      baselineWithoutAnyProtocol: 0,
      baselineForEffectAttribution: 0,
      protocolId,
      attribution: "protocol-restored-capacity",
      effectDetail: "rebound-restored-capacity",
    });
    recordExProtocolDamageOutcome(world, {
      damage: 3,
      hpBefore: 3,
      killed: true,
      baselineWithoutAnyProtocol: 2,
      baselineForEffectAttribution: 2,
      protocolId,
      attribution: "protocol-modified-normal",
      effectDetail: "rebound-return-surge",
    });
    recordExProtocolDamageOutcome(world, {
      damage: 1,
      hpBefore: 5,
      killed: false,
      baselineWithoutAnyProtocol: 2,
      baselineForEffectAttribution: 0.6,
      protocolId,
      attribution: "uncredited-penalty",
    });

    expect(world.stats.exProtocolMetrics).toMatchObject({
      totalPlayerDamage: 8,
      protocolSourceDamage: 4,
      protocolBonusDamageAttributed: 1,
      protocolSourceKills: 1,
      protocolBonusFinisherKills: 1,
      counters: {
        restoredCapacityHitDamage: 4,
        returnSurgeBonusDamage: 1,
      },
    });
  });

  it("records Aegis endpoint-contact interceptions without calling them damage prevention", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const protocolId = toExProtocolId("spread.aegis-fan");
    world.stats.exProtocolMetrics.selectedId = protocolId;

    updateRunStats(world, [
      {
        type: "ex.aegis.intercepted",
        volleyId: 1,
        side: "left",
        enemyProjectileCategory: "standard",
        plannedPlayerEndpointContact: true,
        elapsed: 20,
      },
      {
        type: "ex.aegis.intercepted",
        volleyId: 1,
        side: "right",
        enemyProjectileCategory: "standard",
        plannedPlayerEndpointContact: false,
        elapsed: 20,
      },
    ]);

    expect(world.stats.exProtocolMetrics.counters).toMatchObject({
      intercepts: 2,
      interceptedWithPlannedPlayerEndpointContact: 1,
      leftInterceptions: 1,
      rightInterceptions: 1,
    });
  });
});
