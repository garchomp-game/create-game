import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../../content/exProtocolCatalog";
import type {
  Enemy,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { createWorld } from "../createWorld";
import { resolveCombat } from "../systems/combatSystem";
import { updateShooting } from "../systems/shootingSystem";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("Redline Core", () => {
  it("amplifies the hit that reaches maximum focus", () => {
    const world = createRedlineWorld();
    const events: GameEvent[] = [];
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;
    const enemy = createEnemy("enemy-trigger", bullet.position, 100);
    enemy.pulseFocusStacks = 2;
    enemy.pulseFocusExpiresAt = 10;
    world.enemies = [enemy];

    resolveCombat(world, CANDIDATE_CONFIG, events);

    const baseDamage = CANDIDATE_CONFIG.weapons.pulse.damage;
    const focusedDamage =
      baseDamage +
      baseDamage * world.runtime.pulseFocusBonusPerStack * 2;
    expect(enemy.hp).toBeCloseTo(100 - focusedDamage * 1.4);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.redline.hit",
        totalDamage: focusedDamage * 1.4,
      }),
    );
  });

  it("amplifies a pre-existing maximum-focus hit and restores capacity once", () => {
    const world = createRedlineWorld();
    const events: GameEvent[] = [];
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;
    const first = createEnemy("enemy-first", bullet.position, 100);
    first.pulseFocusStacks = 3;
    first.pulseFocusExpiresAt = 10;
    world.enemies = [first];

    resolveCombat(world, CANDIDATE_CONFIG, events);

    const redlineDamage =
      CANDIDATE_CONFIG.weapons.pulse.damage * 1.4;
    expect(first.hp).toBeCloseTo(100 - redlineDamage);
    expect(world.bullets[0]?.hitsRemaining).toBe(1);
    expect(world.bullets[0]?.candidate?.protocolState).toMatchObject({
      kind: "redline-core",
      capacityRestored: true,
      redlineResolvedDamage: redlineDamage,
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.redline.hit",
        totalDamage: redlineDamage,
      }),
    );

    const second = createEnemy("enemy-second", bullet.position, 100);
    world.enemies = [second];
    resolveCombat(world, CANDIDATE_CONFIG, events);

    expect(second.hp).toBeCloseTo(
      100 - CANDIDATE_CONFIG.weapons.pulse.damage,
    );
    expect(world.bullets).toHaveLength(0);
  });

  it("retains Core Penetration through an ineligible boss extra hit", () => {
    const world = createRedlineWorld({
      evolutionTwoId: "deep-bore",
      masteryUnlocked: true,
    });
    const events: GameEvent[] = [];
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;
    const trigger = createEnemy("enemy-trigger", bullet.position, 100);
    trigger.pulseFocusStacks = 3;
    trigger.pulseFocusExpiresAt = 10;
    world.enemies = [trigger];
    resolveCombat(world, CANDIDATE_CONFIG, events);

    const boss = createEnemy("enemy-boss", bullet.position, 100);
    boss.boss = { bossId: "test-boss" };
    world.enemies = [boss];
    resolveCombat(world, CANDIDATE_CONFIG, events);
    expect(boss.hp).toBeCloseTo(
      100 - CANDIDATE_CONFIG.weapons.pulse.damage,
    );
    expect(world.bullets[0]?.candidate?.protocolState).toMatchObject({
      kind: "redline-core",
      masteryExtraHitConsumed: false,
    });

    const eligible = createEnemy("enemy-eligible", bullet.position, 100);
    world.enemies = [eligible];
    resolveCombat(world, CANDIDATE_CONFIG, events);
    expect(eligible.hp).toBeCloseTo(
      100 - CANDIDATE_CONFIG.weapons.pulse.damage * 1.4 * 1.5,
    );
    expect(bullet.candidate?.protocolState).toMatchObject({
      kind: "redline-core",
      masteryExtraHitConsumed: true,
    });
  });
});

function createRedlineWorld(options?: {
  evolutionTwoId: "deep-bore";
  masteryUnlocked: boolean;
}): WorldState {
  const world = createWorld(CANDIDATE_CONFIG);
  world.state.weaponType = "pulse";
  world.runtime.pulseFocusMaxStacks = 3;
  world.runtime.pulseFocusDuration = 0.9;
  const protocolId = toExProtocolId("pulse.redline-core");
  world.progression.exProtocol = {
    status: "selected",
    route: {
      protocolId,
      selectedAt: 0,
      evolutionOneId: null,
      evolutionOneSelectedAt: null,
      evolutionTwoId: options
        ? toExProtocolEvolutionId(
            protocolId,
            "evolutionTwo",
            options.evolutionTwoId,
          )
        : null,
      evolutionTwoSelectedAt: options ? 0 : null,
      masteryUnlocked: options?.masteryUnlocked ?? false,
      masteryUnlockedAt: options?.masteryUnlocked ? 0 : null,
    },
    runtime: {
      kind: "redline-core",
      protocolId,
      grossMaxHpAtSelection: 100,
    },
  };
  return world;
}

function createEnemy(
  id: string,
  position: { x: number; y: number },
  hp: number,
): Enemy {
  const definition = CANDIDATE_CONFIG.enemies.chaser;
  return {
    id,
    typeId: "chaser",
    position: { ...position },
    radius: definition.radius,
    hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena: true,
  };
}
