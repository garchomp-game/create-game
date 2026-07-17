import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { createWorld } from "../createWorld";
import { updatePlayer } from "./playerSystem";

describe("updatePlayer", () => {
  it("preserves partial analog input magnitude", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const startX = world.player.position.x;

    updatePlayer(world, { x: 0.25, y: 0 }, 1, SIMULATION_CONFIG);

    expect(world.player.position.x - startX).toBeCloseTo(
      SIMULATION_CONFIG.player.speed * 0.25,
    );
  });

  it("clamps diagonal digital input to the configured speed", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const start = { ...world.player.position };

    updatePlayer(world, { x: 1, y: 1 }, 0.25, SIMULATION_CONFIG);

    expect(Math.hypot(
      world.player.position.x - start.x,
      world.player.position.y - start.y,
    )).toBeCloseTo(SIMULATION_CONFIG.player.speed * 0.25);
  });
});
