import * as Phaser from "phaser";
import type { ViewConfig, WorldState } from "../../domain/types";
import {
  getArenaEntitySpriteTint,
  getArenaEntitySpriteVisual,
  getSpriteRotation,
  PLAYER_TEXTURE_KEY,
} from "./PhaserArenaEntityVisuals";
import { ARENA_ENTITY_DEPTH } from "./PhaserArenaDepths";

type PooledImage = {
  image: Phaser.GameObjects.Image;
  seenFrame: number;
};

export class PhaserArenaEntityLayer {
  private readonly playerImage: Phaser.GameObjects.Image;
  private readonly enemyImages = new Map<string, PooledImage>();
  private readonly enemyPool: Phaser.GameObjects.Image[] = [];
  private readonly xpImages = new Map<string, PooledImage>();
  private readonly xpPool: Phaser.GameObjects.Image[] = [];
  private frame = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly viewConfig: ViewConfig,
  ) {
    this.playerImage = this.createImage(PLAYER_TEXTURE_KEY);
  }

  render(world: WorldState): void {
    this.frame += 1;
    this.syncPlayer(world);
    this.syncEnemies(world);
    this.syncXpPickups(world);
  }

  private syncPlayer(world: WorldState): void {
    const visible =
      world.state.status !== "title" &&
      world.state.status !== "weaponSelect" &&
      world.state.status !== "trainingBriefing";
    if (!visible) {
      this.playerImage.setVisible(false);
      return;
    }

    const visual = getArenaEntitySpriteVisual("player", world.player.radius);
    this.playerImage
      .setVisible(true)
      .setPosition(world.player.position.x, world.player.position.y)
      .setDisplaySize(visual.width, visual.height)
      .setRotation(
        getSpriteRotation(world.state.lastAim, visual.textureNose),
      )
      .setAlpha(world.state.damageCooldown > 0 ? 0.72 : 1);
  }

  private syncEnemies(world: WorldState): void {
    for (const enemy of world.enemies) {
      const visualId = enemy.boss ? "boss" : enemy.typeId;
      const visual = getArenaEntitySpriteVisual(visualId, enemy.radius);
      let pooled = this.enemyImages.get(enemy.id);
      const isNew = pooled === undefined;
      if (!pooled) {
        const image = this.acquireImage(this.enemyPool, visual.textureKey);
        pooled = { image, seenFrame: this.frame };
        this.enemyImages.set(enemy.id, pooled);
      } else if (pooled.image.texture.key !== visual.textureKey) {
        pooled.image.setTexture(visual.textureKey);
      }

      const movement = isNew
        ? {
            x: world.player.position.x - enemy.position.x,
            y: world.player.position.y - enemy.position.y,
          }
        : {
            x: enemy.position.x - pooled.image.x,
            y: enemy.position.y - pooled.image.y,
          };
      pooled.seenFrame = this.frame;
      pooled.image
        .setVisible(true)
        .setPosition(enemy.position.x, enemy.position.y)
        .setDisplaySize(visual.width, visual.height)
        .setAlpha(enemy.enteredArena ? 0.98 : 0.72);
      const tint = getArenaEntitySpriteTint(visualId, this.viewConfig);
      if (tint === null) pooled.image.clearTint();
      else pooled.image.setTint(tint);
      if (enemy.boss) {
        pooled.image.setRotation(Math.PI);
      } else if (Math.abs(movement.x) + Math.abs(movement.y) >= 0.0001) {
        pooled.image.setRotation(
          getSpriteRotation(movement, visual.textureNose),
        );
      }
    }

    this.releaseStale(this.enemyImages, this.enemyPool);
  }

  private syncXpPickups(world: WorldState): void {
    for (const pickup of world.pickups) {
      if (pickup.kind !== "xp") continue;

      let pooled = this.xpImages.get(pickup.id);
      if (!pooled) {
        pooled = {
          image: this.acquireImage(
            this.xpPool,
            getArenaEntitySpriteVisual("xp", pickup.radius).textureKey,
          ),
          seenFrame: this.frame,
        };
        this.xpImages.set(pickup.id, pooled);
      }

      const visual = getArenaEntitySpriteVisual("xp", pickup.radius);
      pooled.seenFrame = this.frame;
      pooled.image
        .setVisible(true)
        .setPosition(pickup.position.x, pickup.position.y)
        .setDisplaySize(visual.width, visual.height)
        .setTint(
          getArenaEntitySpriteTint("xp", this.viewConfig) ??
            this.viewConfig.pickup.xpColor,
        )
        .setAlpha(0.52);
    }

    this.releaseStale(this.xpImages, this.xpPool);
  }

  private releaseStale(
    active: Map<string, PooledImage>,
    pool: Phaser.GameObjects.Image[],
  ): void {
    for (const [id, pooled] of active) {
      if (pooled.seenFrame === this.frame) continue;
      pooled.image.setVisible(false).clearTint();
      active.delete(id);
      pool.push(pooled.image);
    }
  }

  private acquireImage(
    pool: Phaser.GameObjects.Image[],
    textureKey: string,
  ): Phaser.GameObjects.Image {
    const image = pool.pop() ?? this.createImage(textureKey);
    image.setTexture(textureKey).setVisible(true);
    return image;
  }

  private createImage(textureKey: string): Phaser.GameObjects.Image {
    return this.scene.add
      .image(-100, -100, textureKey)
      .setOrigin(0.5)
      .setDepth(ARENA_ENTITY_DEPTH)
      .setVisible(false);
  }
}
