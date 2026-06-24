import type { SimulationConfig, Vec2, WorldState } from "../../domain/types";
import { clamp } from "../../math/geometry";
import { normalize } from "../../math/vector";
import { moveCircleWithObstacles } from "./movement";

export function updatePlayer(
  world: WorldState,
  move: Vec2,
  dt: number,
  config: SimulationConfig,
): void {
  const normalizedMove = normalize(move.x, move.y);
  const speed = config.player.speed * world.runtime.playerSpeedMultiplier;
  moveCircleWithObstacles(world, world.player, normalizedMove.x * speed * dt, 0);
  moveCircleWithObstacles(world, world.player, 0, normalizedMove.y * speed * dt);

  world.player.position.x = clamp(
    world.player.position.x,
    config.player.radius,
    config.arena.width - config.player.radius,
  );
  world.player.position.y = clamp(
    world.player.position.y,
    config.player.radius,
    config.arena.height - config.player.radius,
  );
}
