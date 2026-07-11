import type {
  Bullet,
  GameEvent,
  Obstacle,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { circleRect } from "../../math/geometry";

const BOUNCE_EPSILON = 0.000001;
const RICOCHET_LIFETIME_CAP = 0.35;

export function updateBullets(
  world: WorldState,
  dt: number,
  config: SimulationConfig,
  events: GameEvent[] = [],
): void {
  const remainingBullets: Bullet[] = [];

  for (const bullet of world.bullets) {
    const previousPosition = { ...bullet.position };
    bullet.position.x += bullet.velocity.x * dt;
    bullet.position.y += bullet.velocity.y * dt;
    bullet.lifetime -= dt;

    if (bullet.lifetime <= 0) continue;
    if (
      bullet.position.x < 0 ||
      bullet.position.x > config.arena.width ||
      bullet.position.y < 0 ||
      bullet.position.y > config.arena.height
    ) {
      continue;
    }

    const obstacle = world.obstacles.find((candidate) => circleRect(bullet, candidate));
    if (obstacle) {
      if (bullet.ricochetRemaining <= 0) continue;
      ricochetBullet(bullet, obstacle, previousPosition);
      bullet.ricochetRemaining -= 1;
      bullet.ricochetsUsed += 1;
      events.push({
        type: "bullet.ricocheted",
        bulletId: bullet.id,
        volleyId: bullet.volleyId,
        weaponType: bullet.weaponType,
        obstacleId: obstacle.id,
        position: { ...bullet.position },
        ricochetsUsed: bullet.ricochetsUsed,
        ricochetsRemaining: bullet.ricochetRemaining,
      });
      bullet.lifetime = Math.min(bullet.lifetime, RICOCHET_LIFETIME_CAP);
    }

    remainingBullets.push(bullet);
  }

  world.bullets = remainingBullets;
}

function ricochetBullet(bullet: Bullet, obstacle: Obstacle, previousPosition: Vec2): void {
  const left = obstacle.x - bullet.radius;
  const right = obstacle.x + obstacle.width + bullet.radius;
  const top = obstacle.y - bullet.radius;
  const bottom = obstacle.y + obstacle.height + bullet.radius;

  const hitsLeft = previousPosition.x <= left && bullet.position.x > left;
  const hitsRight = previousPosition.x >= right && bullet.position.x < right;
  const hitsTop = previousPosition.y <= top && bullet.position.y > top;
  const hitsBottom = previousPosition.y >= bottom && bullet.position.y < bottom;

  if ((hitsLeft || hitsRight) && (hitsTop || hitsBottom)) {
    ricochetFromNearestFace(bullet, obstacle);
    return;
  }

  if (hitsLeft) {
    bullet.position.x = left - BOUNCE_EPSILON;
    bullet.velocity.x = -Math.abs(bullet.velocity.x);
    return;
  }

  if (hitsRight) {
    bullet.position.x = right + BOUNCE_EPSILON;
    bullet.velocity.x = Math.abs(bullet.velocity.x);
    return;
  }

  if (hitsTop) {
    bullet.position.y = top - BOUNCE_EPSILON;
    bullet.velocity.y = -Math.abs(bullet.velocity.y);
    return;
  }

  if (hitsBottom) {
    bullet.position.y = bottom + BOUNCE_EPSILON;
    bullet.velocity.y = Math.abs(bullet.velocity.y);
    return;
  }

  ricochetFromNearestFace(bullet, obstacle);
}

function ricochetFromNearestFace(bullet: Bullet, obstacle: Obstacle): void {
  const leftDistance = Math.abs(bullet.position.x - obstacle.x);
  const rightDistance = Math.abs(bullet.position.x - (obstacle.x + obstacle.width));
  const topDistance = Math.abs(bullet.position.y - obstacle.y);
  const bottomDistance = Math.abs(bullet.position.y - (obstacle.y + obstacle.height));
  const nearest = Math.min(leftDistance, rightDistance, topDistance, bottomDistance);

  if (nearest === leftDistance) {
    bullet.position.x = obstacle.x - bullet.radius - BOUNCE_EPSILON;
    bullet.velocity.x = -Math.abs(bullet.velocity.x);
  } else if (nearest === rightDistance) {
    bullet.position.x = obstacle.x + obstacle.width + bullet.radius + BOUNCE_EPSILON;
    bullet.velocity.x = Math.abs(bullet.velocity.x);
  } else if (nearest === topDistance) {
    bullet.position.y = obstacle.y - bullet.radius - BOUNCE_EPSILON;
    bullet.velocity.y = -Math.abs(bullet.velocity.y);
  } else {
    bullet.position.y = obstacle.y + obstacle.height + bullet.radius + BOUNCE_EPSILON;
    bullet.velocity.y = Math.abs(bullet.velocity.y);
  }
}
