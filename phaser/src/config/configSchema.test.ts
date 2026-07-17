import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG, VIEW_CONFIG } from "./gameConfig";
import { parseSimulationConfig, parseViewConfig } from "./configSchema";

describe("config schemas", () => {
  it("accepts the default simulation and view config", () => {
    expect(parseSimulationConfig(SIMULATION_CONFIG)).toEqual(SIMULATION_CONFIG);
    expect(parseViewConfig(VIEW_CONFIG)).toEqual(VIEW_CONFIG);
  });

  it("allows Pulse line resonance to be disabled for comparison profiles", () => {
    const config = structuredClone(SIMULATION_CONFIG);
    const focus = config.upgrades.pulseFocus.effect;
    expect(focus.type).toBe("pulseFocus");
    if (focus.type !== "pulseFocus") return;
    focus.lineBonusPerStack = 0;

    expect(
      parseSimulationConfig(config).upgrades.pulseFocus.effect,
    ).toMatchObject({ type: "pulseFocus", lineBonusPerStack: 0 });
  });

  it("rejects invalid simulation dimensions", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        arena: { ...SIMULATION_CONFIG.arena, width: 0 },
      }),
    ).toThrow();
  });

  it("rejects enemy type config without the required chaser definition", () => {
    const { chaser: _chaser, ...enemiesWithoutChaser } = SIMULATION_CONFIG.enemies;

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        enemies: enemiesWithoutChaser,
      }),
    ).toThrow();
  });

  it("rejects weapon config without the required pulse definition", () => {
    const { pulse: _pulse, ...weaponsWithoutPulse } = SIMULATION_CONFIG.weapons;

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        weapons: weaponsWithoutPulse,
      }),
    ).toThrow();
  });

  it("rejects invalid weapon projectile counts", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        weapons: {
          ...SIMULATION_CONFIG.weapons,
          spread: {
            ...SIMULATION_CONFIG.weapons.spread,
            projectileCount: 0,
          },
        },
      }),
    ).toThrow();
  });

  it("rejects invalid weapon ricochet counts", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        weapons: {
          ...SIMULATION_CONFIG.weapons,
          pulse: {
            ...SIMULATION_CONFIG.weapons.pulse,
            ricochetCount: -1,
          },
        },
      }),
    ).toThrow();
  });

  it("rejects invalid upgrade rank and weight values", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        upgrades: {
          ...SIMULATION_CONFIG.upgrades,
          rapidFire: {
            ...SIMULATION_CONFIG.upgrades.rapidFire,
            maxRank: 0,
          },
        },
      }),
    ).toThrow();

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        upgrades: {
          ...SIMULATION_CONFIG.upgrades,
          rapidFire: {
            ...SIMULATION_CONFIG.upgrades.rapidFire,
            weight: 0,
          },
        },
      }),
    ).toThrow();
  });

  it("rejects invalid wave ordering and enemy weights", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        waves: [
          SIMULATION_CONFIG.waves[1],
          SIMULATION_CONFIG.waves[0],
        ],
      }),
    ).toThrow();

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        waves: [
          {
            ...SIMULATION_CONFIG.waves[0]!,
            enemyWeights: { chaser: 0 },
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        waves: [
          {
            ...SIMULATION_CONFIG.waves[0]!,
            start: 1,
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        waves: [
          {
            ...SIMULATION_CONFIG.waves[0]!,
            enemyWeights: {},
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        waves: [
          {
            ...SIMULATION_CONFIG.waves[0]!,
            enemyWeights: { brute: 1 },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects ranged enemies without projectile config", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        enemies: {
          ...SIMULATION_CONFIG.enemies,
          ranged: {
            ...SIMULATION_CONFIG.enemies.ranged,
            ranged: undefined,
          },
        },
      }),
    ).toThrow();
  });

  it("rejects invalid ranged projectile config values", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        enemies: {
          ...SIMULATION_CONFIG.enemies,
          ranged: {
            ...SIMULATION_CONFIG.enemies.ranged,
            ranged: {
              ...SIMULATION_CONFIG.enemies.ranged.ranged!,
              projectileSpeed: 0,
            },
          },
        },
      }),
    ).toThrow();
  });

  it("rejects invalid heal pickup tuning values", () => {
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        pickup: {
          ...SIMULATION_CONFIG.pickup,
          healDropChance: 1.1,
        },
      }),
    ).toThrow();

    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        pickup: {
          ...SIMULATION_CONFIG.pickup,
          healDropPityThreshold: -1,
        },
      }),
    ).toThrow();

    const { ranged: _ranged, ...incompleteMultipliers } =
      SIMULATION_CONFIG.pickup.healEnemyMultipliers;
    expect(() =>
      parseSimulationConfig({
        ...SIMULATION_CONFIG,
        pickup: {
          ...SIMULATION_CONFIG.pickup,
          healEnemyMultipliers: incompleteMultipliers,
        },
      }),
    ).toThrow();
  });

  it("rejects invalid view colors", () => {
    expect(() =>
      parseViewConfig({
        ...VIEW_CONFIG,
        player: { ...VIEW_CONFIG.player, color: 0x1000000 },
      }),
    ).toThrow();
  });
});
