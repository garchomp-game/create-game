import type { SimulationConfig, WorldState } from "../../domain/types";
import { circleRect } from "../../math/geometry";

export function updateEnemyProjectiles(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
): void {
  for (const projectile of world.enemyProjectiles) {
    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.y += projectile.velocity.y * dt;
    projectile.lifetime -= dt;
  }

  world.enemyProjectiles = world.enemyProjectiles.filter((projectile) => {
    if (projectile.lifetime <= 0) return false;
    if (
      projectile.position.x < 0 ||
      projectile.position.x > config.arena.width ||
      projectile.position.y < 0 ||
      projectile.position.y > config.arena.height
    ) {
      return false;
    }
    return !world.obstacles.some((obstacle) => circleRect(projectile, obstacle));
  });
}
