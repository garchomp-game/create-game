import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../../content/exProtocolCatalog";
import type {
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../../domain/types";
import { createWorld } from "../createWorld";
import { updateShooting } from "../systems/shootingSystem";
import {
  getAegisInterceptionRadiusBonus,
  getAegisMovementMultiplier,
  recordAegisInterception,
  resolveAegisDamage,
} from "./aegisFan";

const CANDIDATE_CONFIG: SimulationConfig = {
  ...SIMULATION_CONFIG,
  features: {
    ...SIMULATION_CONFIG.features,
    exProtocols: true,
  },
  exProtocolOfferPolicy: "fixed-compatible",
};

describe("Aegis Fan", () => {
  it("trades only the two outer normal Spread projectiles to 0.60 damage", () => {
    const world = createAegisWorld();
    const events: GameEvent[] = [];

    updateShooting(world, true, CANDIDATE_CONFIG, events);

    expect(world.bullets.map((bullet) => bullet.damage)).toEqual([
      0.6,
      1,
      0.6,
    ]);
    expect(
      world.bullets.map(
        (bullet) => bullet.candidate?.protocolState?.kind ?? null,
      ),
    ).toEqual(["aegis-fan", null, "aegis-fan"]);
  });

  it("restores edge damage to 0.75 without changing the center", () => {
    const world = createAegisWorld({
      evolutionOneId: "restored-edge",
    });

    updateShooting(world, true, CANDIDATE_CONFIG, []);

    expect(world.bullets.map((bullet) => bullet.damage)).toEqual([
      0.75,
      1,
      0.75,
    ]);
  });

  it("consumes one Perfect Guard charge on the next volley and attributes only its uplift", () => {
    const world = createAegisWorld({
      evolutionOneId: "restored-edge",
      masteryUnlocked: true,
    });
    getRuntime(world).perfectGuardCharges = 1;
    const events: GameEvent[] = [];

    updateShooting(world, true, CANDIDATE_CONFIG, events);

    expect(getRuntime(world).perfectGuardCharges).toBe(0);
    expect(world.bullets.map((bullet) => bullet.damage)).toEqual([
      1,
      1,
      1,
    ]);
    const resolution = resolveAegisDamage(
      world,
      world.bullets[0]!,
      1,
    );
    expect(resolution).toMatchObject({
      damage: 1,
      baselineWithoutAnyProtocol: 1,
      baselineForEffectAttribution: 0.75,
      attribution: "protocol-modified-normal",
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.aegis.empowered.volley",
      }),
    );
  });

  it("requires both sides of the same volley before granting Perfect Guard", () => {
    const world = createAegisWorld({ masteryUnlocked: true });
    updateShooting(world, true, CANDIDATE_CONFIG, []);
    const [left, , right] = world.bullets;
    const events: GameEvent[] = [];

    recordAegisInterception(world, left!, events);
    expect(getRuntime(world).perfectGuardCharges).toBe(0);
    recordAegisInterception(world, right!, events);

    expect(getRuntime(world).perfectGuardCharges).toBe(1);
    expect(
      events.filter(
        (event) =>
          event.type === "ex.aegis.perfect-guard.charged",
      ),
    ).toHaveLength(1);
  });

  it("applies Broad Intercept and refreshes Guard Momentum without stacking", () => {
    const world = createAegisWorld({
      evolutionOneId: "broad-intercept",
      evolutionTwoId: "guard-momentum",
    });
    updateShooting(world, true, CANDIDATE_CONFIG, []);
    const edge = world.bullets[0]!;

    expect(getAegisInterceptionRadiusBonus(world)).toBe(6);
    recordAegisInterception(world, edge, []);
    expect(getAegisMovementMultiplier(world)).toBe(1.15);
    world.state.elapsed = 0.4;
    recordAegisInterception(world, edge, []);
    expect(getRuntime(world).guardMomentumUntil).toBe(1);
    world.state.elapsed = 1;
    expect(getAegisMovementMultiplier(world)).toBe(1);
  });
});

type AegisWorldOptions = {
  evolutionOneId?: "restored-edge" | "broad-intercept";
  evolutionTwoId?: "carry-through" | "guard-momentum";
  masteryUnlocked?: boolean;
};

function createAegisWorld(
  options: AegisWorldOptions = {},
): WorldState {
  const world = createWorld(CANDIDATE_CONFIG);
  world.obstacles = [];
  world.state.weaponType = "spread";
  const protocolId = toExProtocolId("spread.aegis-fan");
  world.progression.exProtocol = {
    status: "selected",
    route: {
      protocolId,
      selectedAt: 0,
      evolutionOneId: options.evolutionOneId
        ? toExProtocolEvolutionId(
            protocolId,
            "evolutionOne",
            options.evolutionOneId,
          )
        : null,
      evolutionOneSelectedAt: options.evolutionOneId ? 0 : null,
      evolutionTwoId: options.evolutionTwoId
        ? toExProtocolEvolutionId(
            protocolId,
            "evolutionTwo",
            options.evolutionTwoId,
          )
        : null,
      evolutionTwoSelectedAt: options.evolutionTwoId ? 0 : null,
      masteryUnlocked: options.masteryUnlocked ?? false,
      masteryUnlockedAt: options.masteryUnlocked ? 0 : null,
    },
    runtime: {
      kind: "aegis-fan",
      protocolId,
      perfectGuardCharges: 0,
      guardMomentumUntil: 0,
    },
  };
  return world;
}

function getRuntime(world: WorldState) {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== "aegis-fan"
  ) {
    throw new Error("Expected Aegis Fan runtime.");
  }
  return progression.runtime;
}
