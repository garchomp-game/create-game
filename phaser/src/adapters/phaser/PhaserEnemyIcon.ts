import * as Phaser from "phaser";
import type { EnemyViewConfig, Vec2 } from "../../domain/types";

export function drawEnemyIcon(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  view: EnemyViewConfig,
): void {
  if (view.shape === "circle") {
    graphics.fillStyle(view.color, 1);
    graphics.fillCircle(x, y, radius);
    graphics.lineStyle(2, view.stroke, 1);
    graphics.strokeCircle(x, y, radius);
  } else if (view.shape === "square") {
    graphics.fillStyle(view.color, 1);
    graphics.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    graphics.lineStyle(2, view.stroke, 1);
    graphics.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const points =
      view.shape === "diamond"
        ? [
            { x, y: y - radius * 1.15 },
            { x: x + radius * 1.15, y },
            { x, y: y + radius * 1.15 },
            { x: x - radius * 1.15, y },
          ]
        : regularPolygon(
            x,
            y,
            view.shape === "triangle" ? radius * 1.25 : radius * 1.08,
            view.shape === "triangle" ? 3 : 6,
            view.shape === "triangle" ? -Math.PI / 2 : Math.PI / 6,
          );
    drawPolygon(graphics, points, view.color, view.stroke);
  }

  graphics.lineStyle(2, view.markColor, 0.95);
  if (view.mark === "ring") {
    graphics.strokeCircle(x, y, radius * 0.48);
  } else if (view.mark === "cross") {
    graphics.lineBetween(x - radius * 0.5, y, x + radius * 0.5, y);
    graphics.lineBetween(x, y - radius * 0.5, x, y + radius * 0.5);
  } else if (view.mark === "slash") {
    graphics.lineBetween(
      x - radius * 0.48,
      y + radius * 0.36,
      x + radius * 0.48,
      y - radius * 0.36,
    );
  } else {
    graphics.fillStyle(view.markColor, 1);
    graphics.fillCircle(x, y, radius * 0.28);
    graphics.lineStyle(1, view.stroke, 0.85);
    graphics.strokeCircle(x, y, radius * 0.28);
  }
}

function drawPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vec2[],
  fill: number,
  stroke: number,
): void {
  const first = points[0];
  if (!first) return;
  graphics.beginPath();
  graphics.moveTo(first.x, first.y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.closePath();
  graphics.fillStyle(fill, 1);
  graphics.fillPath();
  graphics.lineStyle(2, stroke, 1);
  graphics.strokePath();
}

function regularPolygon(
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation: number,
): Vec2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    return {
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
    };
  });
}
