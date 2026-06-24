import type { Vec2, WorldState } from "../../domain/types";
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
