import * as Phaser from "phaser";
import type { ViewConfig } from "../../domain/types";

export function drawRecoveryKitIcon(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  view: ViewConfig["pickup"],
): void {
  const lineWidth = Math.max(1.5, size * 0.06);
  const bodyWidth = size;
  const bodyHeight = size * 0.72;
  const bodyLeft = x - bodyWidth / 2;
  const bodyTop = y - bodyHeight * 0.36;
  const cornerRadius = Math.max(2, size * 0.1);
  const handleWidth = size * 0.38;
  const handleHeight = size * 0.18;
  const handleLeft = x - handleWidth / 2;
  const handleTop = bodyTop - handleHeight * 0.72;

  graphics.fillStyle(view.healStroke, 0.14);
  graphics.fillRoundedRect(
    bodyLeft - lineWidth,
    bodyTop - lineWidth,
    bodyWidth + lineWidth * 2,
    bodyHeight + lineWidth * 2,
    cornerRadius + lineWidth,
  );

  graphics.fillStyle(view.healFill, 1);
  graphics.fillRoundedRect(
    handleLeft,
    handleTop,
    handleWidth,
    handleHeight,
    cornerRadius * 0.55,
  );
  graphics.lineStyle(lineWidth, view.healStroke, 1);
  graphics.strokeRoundedRect(
    handleLeft,
    handleTop,
    handleWidth,
    handleHeight,
    cornerRadius * 0.55,
  );

  graphics.fillStyle(view.healFill, 1);
  graphics.fillRoundedRect(
    bodyLeft,
    bodyTop,
    bodyWidth,
    bodyHeight,
    cornerRadius,
  );
  graphics.lineStyle(lineWidth, view.healStroke, 1);
  graphics.strokeRoundedRect(
    bodyLeft,
    bodyTop,
    bodyWidth,
    bodyHeight,
    cornerRadius,
  );

  graphics.lineStyle(Math.max(1, lineWidth * 0.55), view.healStroke, 0.5);
  graphics.lineBetween(
    bodyLeft + size * 0.12,
    bodyTop + size * 0.14,
    bodyLeft + bodyWidth - size * 0.12,
    bodyTop + size * 0.14,
  );

  const crossLong = size * 0.38;
  const crossShort = Math.max(3, size * 0.13);
  graphics.fillStyle(view.healCross, 1);
  graphics.fillRoundedRect(
    x - crossShort / 2,
    bodyTop + bodyHeight / 2 - crossLong / 2,
    crossShort,
    crossLong,
    crossShort * 0.35,
  );
  graphics.fillRoundedRect(
    x - crossLong / 2,
    bodyTop + bodyHeight / 2 - crossShort / 2,
    crossLong,
    crossShort,
    crossShort * 0.35,
  );
}
