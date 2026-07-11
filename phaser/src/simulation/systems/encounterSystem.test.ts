import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { createRandomStreams } from "../../math/random";
import type { GameEvent } from "../../domain/types";
import { createWorld } from "../createWorld";
import { getSpawnWave } from "./spawnSystem";
import {
  chooseEndlessContract,
  recordEncounterMovement,
  updateEncounter,
} from "./encounterSystem";

describe("ranged surge encounter", () => {
  it("reproduces a warning, active, recovery, and contract timeline from the encounter stream", () => {
    const first = createWorld(SIMULATION_CONFIG);
    const second = createWorld(SIMULATION_CONFIG);
    const firstRandom = createRandomStreams(20260619);
    const secondRandom = createRandomStreams(20260619);
    const events: GameEvent[] = [];

    updateEncounter(first, firstRandom.encounter, SIMULATION_CONFIG, events);
    updateEncounter(second, secondRandom.encounter, SIMULATION_CONFIG, []);
    const scheduledAt = first.encounter.rangedSurge.scheduledAt!;
    expect(scheduledAt).toBe(second.encounter.rangedSurge.scheduledAt);
    expect(scheduledAt).toBeGreaterThanOrEqual(135);
    expect(scheduledAt).toBeLessThanOrEqual(165);
    expect(events).toContainEqual({
      type: "encounter.scheduled",
      encounterId: "rangedSurge",
      scheduledAt,
    });

    first.state.elapsed = scheduledAt - SIMULATION_CONFIG.encounter.rangedSurge.warningDuration;
    updateEncounter(first, firstRandom.encounter, SIMULATION_CONFIG, events);
    expect(first.encounter.rangedSurge.phase).toBe("warning");

    first.state.elapsed = scheduledAt;
    updateEncounter(first, firstRandom.encounter, SIMULATION_CONFIG, events);
    expect(first.encounter.rangedSurge.phase).toBe("active");
    expect(getSpawnWave(first, SIMULATION_CONFIG)).toMatchObject({
      spawnBudget: 4,
      enemyWeights: { ranged: 3 },
    });

    first.state.elapsed = scheduledAt + SIMULATION_CONFIG.encounter.rangedSurge.activeDuration;
    updateEncounter(first, firstRandom.encounter, SIMULATION_CONFIG, events);
    expect(first.encounter.rangedSurge.phase).toBe("recovery");

    first.state.elapsed =
      scheduledAt +
      SIMULATION_CONFIG.encounter.rangedSurge.activeDuration +
      SIMULATION_CONFIG.encounter.rangedSurge.recoveryDuration;
    updateEncounter(first, firstRandom.encounter, SIMULATION_CONFIG, events);
    expect(first.encounter.rangedSurge.phase).toBe("completed");

    first.state.elapsed = SIMULATION_CONFIG.encounter.contract.offerAt;
    updateEncounter(first, firstRandom.encounter, SIMULATION_CONFIG, events);
    expect(first.state.status).toBe("contractSelect");
    expect(first.encounter.contract.status).toBe("offered");
  });

  it("applies overdrive once and leaves the standard choice unchanged", () => {
    const overdrive = createWorld(SIMULATION_CONFIG);
    overdrive.state.status = "contractSelect";
    overdrive.encounter.contract.status = "offered";
    overdrive.state.elapsed = 240;
    overdrive.enemies.push({
      id: "enemy-test",
      typeId: "chaser",
      position: { x: 0, y: 0 },
      radius: 14,
      hp: 1,
      damage: 12,
      speed: 100,
      score: 10,
      xpValue: 1,
      behavior: "chase",
      attackTimer: 0,
      enteredArena: true,
    });
    const events: GameEvent[] = [];

    chooseEndlessContract(overdrive, 1, SIMULATION_CONFIG, events);

    expect(overdrive.state.status).toBe("playing");
    expect(overdrive.encounter.contract).toMatchObject({
      choice: "overdrive",
      enemySpeedMultiplier: 1.12,
      scoreMultiplier: 1.3,
    });
    expect(overdrive.enemies[0]?.speed).toBeCloseTo(112);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "contract.selected", choice: "overdrive" }),
    );

    const standard = createWorld(SIMULATION_CONFIG);
    standard.state.status = "contractSelect";
    standard.encounter.contract.status = "offered";
    chooseEndlessContract(standard, 0, SIMULATION_CONFIG, []);
    expect(standard.encounter.contract).toMatchObject({
      choice: "standard",
      enemySpeedMultiplier: 1,
      scoreMultiplier: 1,
    });
  });

  it("records movement windows and supports a fully disabled standard state", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.encounter.rangedSurge.scheduledAt = 150;
    world.state.elapsed = 139;
    recordEncounterMovement(world, { x: 3, y: 4 }, SIMULATION_CONFIG);
    world.encounter.rangedSurge.phase = "warning";
    world.state.elapsed = 146;
    recordEncounterMovement(world, { x: -2, y: 0 }, SIMULATION_CONFIG);
    expect(world.stats.encounterMetrics.movement).toMatchObject({
      baseline: { distance: 5, vector: { x: 3, y: 4 } },
      warning: { distance: 2, vector: { x: -2, y: 0 } },
    });

    const disabledConfig = {
      ...SIMULATION_CONFIG,
      features: { ...SIMULATION_CONFIG.features, rangedSurge: false, endlessContract: false },
    };
    const disabled = createWorld(disabledConfig);
    updateEncounter(
      disabled,
      createRandomStreams(1).encounter,
      disabledConfig,
      [],
    );
    expect(disabled.encounter.rangedSurge.scheduledAt).toBeNull();
    expect(disabled.encounter.contract.status).toBe("pending");
  });
});
