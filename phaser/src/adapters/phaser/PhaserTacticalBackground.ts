import * as Phaser from "phaser";
import type { SimulationConfig, ViewConfig } from "../../domain/types";

export class PhaserTacticalBackground {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private drawCount = 0;
  private drawDurationMs = 0;

  constructor(
    scene: Phaser.Scene,
    simulationConfig: SimulationConfig,
    viewConfig: ViewConfig,
  ) {
    this.graphics = scene.add.graphics().setDepth(-20);
    const startedAt = now();
    this.draw(simulationConfig, viewConfig);
    this.drawDurationMs = now() - startedAt;
    this.drawCount = 1;
  }

  getSnapshot(): { drawCount: number; drawDurationMs: number } {
    return {
      drawCount: this.drawCount,
      drawDurationMs: this.drawDurationMs,
    };
  }

  private draw(
    simulationConfig: SimulationConfig,
    viewConfig: ViewConfig,
  ): void {
    const { width, height } = simulationConfig.arena;
    const center = { x: width / 2, y: height / 2 };
    this.graphics.fillStyle(viewConfig.arena.background, 1);
    this.graphics.fillRect(0, 0, width, height);

    const gridSize = 48;
    for (let x = gridSize; x < width; x += gridSize) {
      const major = x % (gridSize * 4) === 0;
      this.graphics.lineStyle(major ? 1.5 : 1, major ? 0x41605a : 0x293b38, major ? 0.28 : 0.2);
      this.graphics.lineBetween(x + 0.5, 0, x + 0.5, height);
    }
    for (let y = gridSize; y < height; y += gridSize) {
      const major = y % (gridSize * 3) === 0;
      this.graphics.lineStyle(major ? 1.5 : 1, major ? 0x41605a : 0x293b38, major ? 0.28 : 0.2);
      this.graphics.lineBetween(0, y + 0.5, width, y + 0.5);
    }

    this.graphics.lineStyle(1, 0x52635f, 0.28);
    this.graphics.strokeCircle(center.x, center.y, 84);
    this.graphics.strokeCircle(center.x, center.y, 168);
    this.graphics.lineBetween(center.x - 194, center.y, center.x - 112, center.y);
    this.graphics.lineBetween(center.x + 112, center.y, center.x + 194, center.y);
    this.graphics.lineBetween(center.x, center.y - 194, center.x, center.y - 112);
    this.graphics.lineBetween(center.x, center.y + 112, center.x, center.y + 194);

    const cornerLength = 34;
    const inset = 18;
    this.graphics.lineStyle(2, 0x6b7b77, 0.34);
    for (const [x, y, horizontal, vertical] of [
      [inset, inset, 1, 1],
      [width - inset, inset, -1, 1],
      [inset, height - inset, 1, -1],
      [width - inset, height - inset, -1, -1],
    ] as const) {
      this.graphics.lineBetween(x, y, x + horizontal * cornerLength, y);
      this.graphics.lineBetween(x, y, x, y + vertical * cornerLength);
    }

    this.graphics.lineStyle(3, viewConfig.arena.border, 0.9);
    this.graphics.strokeRect(1.5, 1.5, width - 3, height - 3);
  }
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
