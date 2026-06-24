import type { SimulationConfig, WorldState } from "../../domain/types";
import { circleRect } from "../../math/geometry";

export function updateBullets(world: WorldState, dt: number, config: SimulationConfig): void {
  for (const bullet of world.bullets) {
    bullet.position.x += bullet.velocity.x * dt;
    bullet.position.y += bullet.velocity.y * dt;
    bullet.lifetime -= dt;
  }

  world.bullets = world.bullets.filter((bullet) => {
    if (bullet.lifetime <= 0) return false;
    if (
      bullet.position.x < 0 ||
      bullet.position.x > config.arena.width ||
      bullet.position.y < 0 ||
      bullet.position.y > config.arena.height
    ) {
      return false;
    }
    return !world.obstacles.some((obstacle) => circleRect(bullet, obstacle));
  });
}
