import * as Phaser from "phaser";
import type { ViewConfig } from "../../domain/types";
import { drawRecoveryKitIcon } from "./PhaserRecoveryKitIcon";
import { drawEnemyProjectileIcon } from "./PhaserEnemyProjectileIcon";

export const ENEMY_PROJECTILE_TEXTURE_KEY =
  "arena-generated-enemy-projectile";
export const BOSS_PROJECTILE_TEXTURE_KEY =
  "arena-generated-boss-projectile";
export const RECOVERY_KIT_TEXTURE_KEY = "arena-generated-recovery-kit";

export const ENEMY_PROJECTILE_TEXTURE_SIZE = 32;
export const ENEMY_PROJECTILE_TEXTURE_RADIUS = 5;
export const RECOVERY_KIT_TEXTURE_SIZE = 48;

export function ensureArenaGeneratedTextures(
  scene: Phaser.Scene,
  viewConfig: ViewConfig,
): void {
  if (!scene.textures.exists(ENEMY_PROJECTILE_TEXTURE_KEY)) {
    generateEnemyProjectileTexture(
      scene,
      viewConfig,
      ENEMY_PROJECTILE_TEXTURE_KEY,
      false,
    );
  }
  if (!scene.textures.exists(BOSS_PROJECTILE_TEXTURE_KEY)) {
    generateEnemyProjectileTexture(
      scene,
      viewConfig,
      BOSS_PROJECTILE_TEXTURE_KEY,
      true,
    );
  }
  if (!scene.textures.exists(RECOVERY_KIT_TEXTURE_KEY)) {
    const graphics = scene.add.graphics().setVisible(false);
    drawRecoveryKitIcon(
      graphics,
      RECOVERY_KIT_TEXTURE_SIZE / 2,
      RECOVERY_KIT_TEXTURE_SIZE / 2,
      RECOVERY_KIT_TEXTURE_SIZE / 2,
      viewConfig.pickup,
    );
    graphics.generateTexture(
      RECOVERY_KIT_TEXTURE_KEY,
      RECOVERY_KIT_TEXTURE_SIZE,
      RECOVERY_KIT_TEXTURE_SIZE,
    );
    graphics.destroy();
  }
}

function generateEnemyProjectileTexture(
  scene: Phaser.Scene,
  viewConfig: ViewConfig,
  textureKey: string,
  bossProjectile: boolean,
): void {
  const graphics = scene.add.graphics().setVisible(false);
  drawEnemyProjectileIcon(
    graphics,
    ENEMY_PROJECTILE_TEXTURE_SIZE / 2,
    ENEMY_PROJECTILE_TEXTURE_SIZE / 2,
    ENEMY_PROJECTILE_TEXTURE_RADIUS,
    viewConfig.enemyProjectile,
    bossProjectile,
  );
  graphics.generateTexture(
    textureKey,
    ENEMY_PROJECTILE_TEXTURE_SIZE,
    ENEMY_PROJECTILE_TEXTURE_SIZE,
  );
  graphics.destroy();
}
