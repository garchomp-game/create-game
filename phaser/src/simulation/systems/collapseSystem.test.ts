import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import type { GameEvent } from "../../domain/types";
import { createWorld } from "../createWorld";
import {
  getCollapseInset,
  getCollapseSafeBounds,
  getCollapseStage,
  isInsideCollapseSafeArea,
  updateArenaCollapse,
} from "./collapseSystem";
import { updateRunStats } from "./statsSystem";

describe("arena collapse", () => {
  it("advances on fixed boundaries and eventually removes every safe position", () => {
    const collapse = SIMULATION_CONFIG.encounter.collapse;

    expect(getCollapseStage(SIMULATION_CONFIG, collapse.startsAt - 0.001)).toBe(0);
    expect(getCollapseStage(SIMULATION_CONFIG, collapse.startsAt)).toBe(1);
    expect(getCollapseStage(SIMULATION_CONFIG, collapse.startsAt + collapse.stepSeconds)).toBe(2);

    const finalInset = getCollapseInset(SIMULATION_CONFIG, 15);
    const finalBounds = getCollapseSafeBounds(SIMULATION_CONFIG, finalInset);
    expect(finalInset).toBe(SIMULATION_CONFIG.arena.height / 2);
    expect(
      isInsideCollapseSafeArea(
        {
          x: SIMULATION_CONFIG.arena.width / 2,
          y: SIMULATION_CONFIG.arena.height / 2,
        },
        SIMULATION_CONFIG.player.radius,
        finalBounds,
      ),
    ).toBe(false);
  });

  it("damages only outside the safe area and records collapse telemetry", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const events: GameEvent[] = [];
    world.state.elapsed = SIMULATION_CONFIG.encounter.collapse.startsAt;

    updateArenaCollapse(world, 0.1, SIMULATION_CONFIG, events);
    expect(world.encounter.collapse.stage).toBe(1);
    expect(world.state.hp).toBe(SIMULATION_CONFIG.player.maxHp);

    world.player.position.x = 0;
    updateArenaCollapse(world, 0.1, SIMULATION_CONFIG, events);
    const hpAfterFirstTick = world.state.hp;
    expect(hpAfterFirstTick).toBe(
      SIMULATION_CONFIG.player.maxHp - SIMULATION_CONFIG.encounter.collapse.baseDamage,
    );

    updateArenaCollapse(world, 0.1, SIMULATION_CONFIG, events);
    expect(world.state.hp).toBe(hpAfterFirstTick);

    updateRunStats(world, events);
    expect(world.stats.damageTakenBySource.collapse).toBe(
      SIMULATION_CONFIG.encounter.collapse.baseDamage,
    );
    expect(world.stats.encounterMetrics).toMatchObject({
      collapseStartedAt: SIMULATION_CONFIG.encounter.collapse.startsAt,
      peakCollapseStage: 1,
      collapseDamageTaken: SIMULATION_CONFIG.encounter.collapse.baseDamage,
    });
  });
});
