import { describe, expect, it } from "vitest";
import { TELEGRAPH_CHARGER_DEFINITION } from "../../content/chargerCatalog";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { Enemy, GameEvent, Vec2, WeaponTypeId, WorldState } from "../../domain/types";
import { createWorld } from "../createWorld";
import { resolveCombat } from "./combatSystem";
import {
  spawnTelegraphCharger,
  updateChargerEnemy,
} from "./chargerEnemySystem";
import { updateRunStats } from "./statsSystem";

describe("chargerEnemySystem", () => {
  it.each([
    ["pulse", "east"],
    ["pulse", "west"],
    ["pulse", "north"],
    ["pulse", "south"],
    ["spread", "east"],
    ["spread", "west"],
    ["spread", "north"],
    ["spread", "south"],
  ] as const)("lets %s avoid a telegraphed %s charge and counter during recovery", (weapon, side) => {
    const fixture = createChargeFixture(weapon, side);
    const { world, charger, events } = fixture;
    startTelegraph(fixture);
    expect(charger.action?.phase).toBe("telegraph");
    const lockedDirection = { ...charger.action!.chargeDirection! };

    movePlayerOffChargeLine(world, side);
    advancePhase(fixture);
    expect(charger.action?.phase).toBe("prepare");
    advancePhase(fixture);
    expect(charger.action?.phase).toBe("charge");
    expect(charger.action?.chargeDirection).toEqual(lockedDirection);

    while (charger.action?.phase === "charge") {
      world.state.elapsed = Math.min(
        charger.action.phaseEndsAt,
        world.state.elapsed + 0.05,
      );
      updateChargerEnemy(world, charger, 0.05, SIMULATION_CONFIG, events);
      resolveCombat(world, SIMULATION_CONFIG, events);
    }

    expect(world.state.hp).toBe(SIMULATION_CONFIG.player.maxHp);
    expect(charger.action?.phase).toBe("recovery");
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "enemy.charger.charge.ended",
        hitPlayer: false,
      }),
    );
    const recoveryPosition = { ...charger.position };
    world.state.elapsed += TELEGRAPH_CHARGER_DEFINITION.recoverySeconds * 0.5;
    updateChargerEnemy(world, charger, 0.5, SIMULATION_CONFIG, events);
    expect(charger.position).toEqual(recoveryPosition);

    world.state.elapsed = charger.action!.phaseEndsAt;
    updateChargerEnemy(world, charger, 0, SIMULATION_CONFIG, events);
    expect(charger.action?.phase).toBe("approach");
    expect(events).toContainEqual(
      expect.objectContaining({ type: "enemy.charger.recovered" }),
    );
  });

  it("interrupts a charge on an obstacle instead of sliding through it", () => {
    const fixture = createChargeFixture("pulse", "east");
    fixture.world.obstacles = [
      { id: "charge-wall", x: 330, y: 230, width: 40, height: 80 },
    ];
    startTelegraph(fixture);
    advancePhase(fixture);
    advancePhase(fixture);

    while (fixture.charger.action?.phase === "charge") {
      fixture.world.state.elapsed += 0.05;
      updateChargerEnemy(
        fixture.world,
        fixture.charger,
        0.05,
        SIMULATION_CONFIG,
        fixture.events,
      );
    }

    expect(fixture.charger.action?.phase).toBe("recovery");
    expect(fixture.events).toContainEqual(
      expect.objectContaining({
        type: "enemy.charger.charge.ended",
        reason: "obstacle",
      }),
    );
    expect(fixture.charger.position.x).toBeLessThan(330);
  });

  it("reserves at most two simultaneous warnings and never starts offscreen", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.obstacles = [];
    const events: GameEvent[] = [];
    const positions = [
      { x: 220, y: 230 },
      { x: 220, y: 270 },
      { x: 220, y: 310 },
    ];
    const chargers = positions.map((position) =>
      spawnTelegraphCharger(world, position, SIMULATION_CONFIG, events)!,
    );
    chargers.forEach((charger) => {
      charger.enteredArena = true;
      charger.action!.phaseEndsAt = 0;
    });
    for (const charger of chargers) {
      updateChargerEnemy(world, charger, 0, SIMULATION_CONFIG, events);
    }
    expect(chargers.filter((charger) => charger.action?.phase === "telegraph")).toHaveLength(2);
    expect(chargers.filter((charger) => charger.action?.phase === "approach")).toHaveLength(1);

    const offscreen = spawnTelegraphCharger(
      world,
      { x: -32, y: 270 },
      SIMULATION_CONFIG,
      events,
    )!;
    offscreen.action!.phaseEndsAt = 0;
    updateChargerEnemy(world, offscreen, 0, SIMULATION_CONFIG, events);
    expect(offscreen.action?.phase).toBe("approach");
  });

  it("records charger-specific contact, avoidance, kill, and JSON metrics", () => {
    const fixture = createChargeFixture("spread", "east");
    const { world, charger, events } = fixture;
    charger.position = { ...world.player.position };
    charger.action!.phase = "charge";
    charger.action!.chargeDirection = { x: 1, y: 0 };
    charger.action!.phaseEndsAt = world.state.elapsed + 1;
    resolveCombat(world, SIMULATION_CONFIG, events);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "enemy.charger.player.hit",
        enemyId: charger.id,
      }),
    );

    charger.hp = 1;
    world.bullets = [createBulletAt(charger.position, "spread")];
    resolveCombat(world, SIMULATION_CONFIG, events);
    updateRunStats(world, events);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "enemy.charger.killed",
        enemyId: charger.id,
        weaponType: "spread",
      }),
    );
    expect(world.stats.encounterMetrics.charger).toMatchObject({
      spawned: 1,
      playerHits: 1,
      killed: 1,
      killsByWeapon: { pulse: 0, spread: 1, pierce: 0 },
    });
    expect(
      JSON.parse(JSON.stringify(world.stats)).encounterMetrics.charger,
    ).toEqual(world.stats.encounterMetrics.charger);
  });
});

type ChargeFixture = {
  world: ReturnType<typeof createWorld>;
  charger: Enemy;
  events: GameEvent[];
};

function createChargeFixture(
  weapon: WeaponTypeId,
  side: "east" | "west" | "north" | "south",
): ChargeFixture {
  const world = createWorld(SIMULATION_CONFIG);
  world.obstacles = [];
  world.state.weaponType = weapon;
  const events: GameEvent[] = [];
  const positions = {
    east: { x: 200, y: 270 },
    west: { x: 760, y: 270 },
    north: { x: 480, y: 90 },
    south: { x: 480, y: 450 },
  } as const;
  const charger = spawnTelegraphCharger(
    world,
    positions[side],
    SIMULATION_CONFIG,
    events,
  )!;
  charger.enteredArena = true;
  charger.action!.phaseEndsAt = 0;
  return { world, charger, events };
}

function startTelegraph(fixture: ChargeFixture): void {
  updateChargerEnemy(
    fixture.world,
    fixture.charger,
    0,
    SIMULATION_CONFIG,
    fixture.events,
  );
}

function advancePhase(fixture: ChargeFixture): void {
  fixture.world.state.elapsed = fixture.charger.action!.phaseEndsAt;
  updateChargerEnemy(
    fixture.world,
    fixture.charger,
    0,
    SIMULATION_CONFIG,
    fixture.events,
  );
}

function movePlayerOffChargeLine(
  world: ReturnType<typeof createWorld>,
  side: "east" | "west" | "north" | "south",
): void {
  if (side === "east" || side === "west") {
    world.player.position.y = 430;
  } else {
    world.player.position.x = 720;
  }
}

function createBulletAt(position: Vec2, weaponType: WeaponTypeId): WorldState["bullets"][number] {
  return {
    id: "bullet-charger-test",
    volleyId: 1,
    weaponType,
    position: { ...position },
    radius: 4,
    velocity: { x: 0, y: 0 },
    lifetime: 1,
    damage: 2,
    hitsRemaining: 1,
    ricochetRemaining: 0,
    ricochetsUsed: 0,
    ricochetSurfaceKind: null,
    ricochetBoundarySide: null,
    hitEnemyIds: [],
  };
}
