import * as Phaser from "phaser";
import type { Vec2, ViewConfig } from "../../domain/types";
import {
  getArenaEntitySpriteTint,
  getArenaEntitySpriteVisual,
  getSpriteRotation,
  type ArenaEntityVisualId,
} from "./PhaserArenaEntityVisuals";

type EntityPreviewRenderOptions = {
  x: number;
  y: number;
  radius: number;
  alpha?: number;
  direction?: Vec2;
  rotation?: number;
  displayScale?: number;
};

export class PhaserArenaEntityPreview {
  private readonly image: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private readonly visualId: ArenaEntityVisualId,
    private readonly viewConfig: ViewConfig,
    depth: number,
  ) {
    const visual = getArenaEntitySpriteVisual(visualId, 1);
    this.image = scene.add
      .image(-100, -100, visual.textureKey)
      .setOrigin(0.5)
      .setDepth(depth)
      .setVisible(false);
  }

  hide(): void {
    this.image.setVisible(false);
  }

  render(options: EntityPreviewRenderOptions): void {
    const visual = getArenaEntitySpriteVisual(this.visualId, options.radius);
    const tint = getArenaEntitySpriteTint(this.visualId, this.viewConfig);
    const displayScale = options.displayScale ?? 1;
    const rotation =
      options.rotation ??
      (options.direction
        ? getSpriteRotation(options.direction, visual.textureNose)
        : 0);

    this.image
      .setTexture(visual.textureKey)
      .setPosition(options.x, options.y)
      .setDisplaySize(
        visual.width * displayScale,
        visual.height * displayScale,
      )
      .setRotation(rotation)
      .setAlpha(options.alpha ?? 1)
      .setVisible(true);
    if (tint === null) this.image.clearTint();
    else this.image.setTint(tint);
  }
}
