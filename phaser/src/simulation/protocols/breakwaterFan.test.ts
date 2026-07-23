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
import { updateShooting } from "../systems/shootingSystem";
import {
  activateBreakwaterFan,
  getBreakwaterMovementMultiplier,
  recordBreakwaterNormalHit,
} from "./breakwaterFan";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("Breakwater Fan", () => {
  it("charges from two distinct close-range targets in one normal volley", () => {
    const world = createBreakwaterWorld();
    const events: GameEvent[] = [];
    updateShooting(world, true, CANDIDATE_CONFIG, events);
    const bullet = world.bullets[0]!;

    for (let index = 0; index < 2; index += 1) {
      recordBreakwaterNormalHit(
        world,
        bullet,
        createEnemy(
          `enemy-${index}`,
          world.player.position.x + 80 + index * 20,
          world.player.position.y,
        ),
        events,
      );
    }

    expect(getRuntime(world).charges).toBe(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.breakwater.charged",
        charge: 1,
      }),
    );
  });

  it("spends integrity, resolves only the front cone, and safely pushes survivors", () => {
    const world = createBreakwaterWorld();
    getRuntime(world).charges = 1;
    world.state.lastAim = { x: 1, y: 0 };
    const front = createEnemy(
      "enemy-front",
      world.player.position.x + 100,
      world.player.position.y,
      100,
      1,
    );
    const behind = createEnemy(
      "enemy-behind",
      world.player.position.x - 100,
      world.player.position.y,
      100,
      2,
    );
    const boss = createEnemy(
      "enemy-boss",
      world.player.position.x + 140,
      world.player.position.y + 10,
      100,
      3,
    );
    boss.boss = { bossId: "test-boss" };
    world.enemies = [behind, boss, front];
    const events: GameEvent[] = [];

    activateBreakwaterFan(
      world,
      true,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.state.hp).toBe(90);
    expect(getRuntime(world).charges).toBe(0);
    expect(getRuntime(world).cooldownUntil).toBe(6);
    expect(events.slice(0, 2).map((event) => event.type)).toEqual([
      "player.integrity.spent",
      "ex.special.activated",
    ]);
    expect(front.hp).toBe(98);
    expect(front.position.x).toBeCloseTo(
      world.player.position.x + 180,
    );
    expect(behind.hp).toBe(100);
    expect(behind.position.x).toBe(
      world.player.position.x - 100,
    );
    expect(boss.hp).toBeCloseTo(99.75);
    expect(boss.position.x).toBe(
      world.player.position.x + 140,
    );
  });

  it("rejects insufficient integrity without consuming charge or cooldown", () => {
    const world = createBreakwaterWorld();
    const runtime = getRuntime(world);
    runtime.charges = 1;
    world.state.hp = 10;
    const events: GameEvent[] = [];

    activateBreakwaterFan(
      world,
      true,
      CANDIDATE_CONFIG,
      events,
    );

    expect(world.state.hp).toBe(10);
    expect(runtime.charges).toBe(1);
    expect(runtime.cooldownUntil).toBe(0);
    expect(events).toEqual([
      expect.objectContaining({
        type: "ex.special.rejected",
        reason: "insufficient-hp",
      }),
    ]);
  });

  it("refreshes Escape Current after affecting five non-boss targets", () => {
    const world = createBreakwaterWorld({
      evolutionTwoId: "wide-break",
      masteryUnlocked: true,
    });
    const runtime = getRuntime(world);
    runtime.charges = 1;
    world.enemies = Array.from({ length: 5 }, (_, index) =>
      createEnemy(
        `enemy-${index}`,
        world.player.position.x + 100,
        world.player.position.y - 40 + index * 20,
        100,
        index + 1,
      ),
    );
    const events: GameEvent[] = [];

    activateBreakwaterFan(
      world,
      true,
      CANDIDATE_CONFIG,
      events,
    );

    expect(runtime.escapeCurrentUntil).toBe(1.25);
    expect(getBreakwaterMovementMultiplier(world)).toBe(1.2);
    world.state.elapsed = 1.25;
    expect(getBreakwaterMovementMultiplier(world)).toBe(1);
  });
});

function createBreakwaterWorld(options?: {
  evolutionTwoId: "wide-break";
  masteryUnlocked: boolean;
}): WorldState {
  const world = createWorld(CANDIDATE_CONFIG);
  world.obstacles = [];
  world.state.weaponType = "spread";
  const protocolId = toExProtocolId("spread.breakwater-fan");
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
      kind: "breakwater-fan",
      protocolId,
      charges: 0,
      cooldownUntil: 0,
      nextActivationId: 1,
      escapeCurrentUntil: 0,
      grossMaxHpAtSelection: 100,
      hpCostAtSelection: 10,
    },
  };
  return world;
}

function getRuntime(world: WorldState) {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "breakwater-fan"
  ) {
    throw new Error("Expected Breakwater Fan runtime.");
  }
  return progression.runtime;
}

function createEnemy(
  id: string,
  x: number,
  y: number,
  hp = 10,
  creationOrdinal = 1,
): Enemy {
  const definition = CANDIDATE_CONFIG.enemies.chaser;
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
