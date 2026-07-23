import type {
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { circleRect } from "../../math/geometry";

type MovableCircle = {
  position: Vec2;
  radius: number;
};

export function moveCircleWithObstacles(
  world: WorldState,
  circle: MovableCircle,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  const previousX = circle.position.x;
  const previousY = circle.position.y;
  circle.position.x += dx;
  circle.position.y += dy;

  if (world.obstacles.some((obstacle) => circleRect(circle, obstacle))) {
    circle.position.x = previousX;
    circle.position.y = previousY;
  }
}

export function moveCircleSafely(
  world: WorldState,
  circle: MovableCircle,
  dx: number,
  dy: number,
  config: SimulationConfig,
): number {
  const distance = Math.hypot(dx, dy);
  if (distance <= Number.EPSILON) return 0;
  const start = { ...circle.position };
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, circle.radius / 2)));
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let step = 0; step < steps; step += 1) {
    const next = {
      x: circle.position.x + stepX,
      y: circle.position.y + stepY,
    };
    if (
      next.x < circle.radius ||
      next.x > config.arena.width - circle.radius ||
      next.y < circle.radius ||
      next.y > config.arena.height - circle.radius
    ) {
      break;
    }
    const previous = circle.position;
    circle.position = next;
    if (world.obstacles.some((obstacle) => circleRect(circle, obstacle))) {
      circle.position = previous;
      break;
    }
  }
  return Math.hypot(
    circle.position.x - start.x,
    circle.position.y - start.y,
  );
}
