import * as Phaser from "phaser";
import type { ViewConfig } from "../../domain/types";

export function drawEnemyProjectileIcon(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  projectileRadius: number,
  view: ViewConfig["enemyProjectile"],
  bossProjectile = false,
): void {
  const radius = projectileRadius + 3;
  const points = [
    { x, y: y - radius },
    { x: x + radius, y },
    { x, y: y + radius },
    { x: x - radius, y },
  ];
  graphics.fillStyle(bossProjectile ? 0x9f1239 : view.color, 1);
  tracePolygon(graphics, points);
  graphics.fillPath();
  graphics.lineStyle(2, bossProjectile ? 0xfef08a : view.stroke, 1);
  tracePolygon(graphics, points);
  graphics.strokePath();
  graphics.lineStyle(1, view.core, 0.95);
  graphics.lineBetween(
    x - radius * 0.45,
    y,
    x + radius * 0.45,
    y,
  );
  graphics.lineBetween(
    x,
    y - radius * 0.45,
    x,
    y + radius * 0.45,
  );
  graphics.fillStyle(view.core, 1);
  graphics.fillCircle(x, y, Math.max(2, projectileRadius * 0.35));
  if (bossProjectile) {
    graphics.lineStyle(2, 0xfb7185, 0.9);
    graphics.strokeCircle(x, y, radius + 3);
  }
}

function tracePolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly { x: number; y: number }[],
): void {
  const first = points[0];
  if (!first) return;
  graphics.beginPath();
  graphics.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    graphics.lineTo(point.x, point.y);
  }
  graphics.closePath();
}
