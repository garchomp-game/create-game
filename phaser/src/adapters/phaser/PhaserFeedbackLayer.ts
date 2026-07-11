import Phaser from "phaser";
import type { ProfileSettings } from "../../domain/profile";
import type { GameEvent, Vec2, WorldState } from "../../domain/types";

const MAX_IMPACTS = 64;
const MAX_PARTICLES = 256;

type ImpactRing = {
  position: Vec2;
  age: number;
  lifetime: number;
  radius: number;
  color: number;
};

type BurstParticle = {
  position: Vec2;
  velocity: Vec2;
  age: number;
  lifetime: number;
  radius: number;
  color: number;
};

export type FeedbackSnapshot = {
  impactCount: number;
  particleCount: number;
  screenFlashAlpha: number;
};

export class PhaserFeedbackLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly impacts: ImpactRing[] = [];
  private readonly particles: BurstParticle[] = [];
  private screenFlashAlpha = 0;
  private flashIntensity = 1;
  private shakeIntensity = 1;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(14);
  }

  configure(settings: Pick<ProfileSettings, "flashIntensity" | "shakeIntensity">): void {
    this.flashIntensity = settings.flashIntensity;
    this.shakeIntensity = settings.shakeIntensity;
    if (this.flashIntensity === 0) this.screenFlashAlpha = 0;
    if (this.shakeIntensity === 0) this.scene.cameras.main.resetFX();
  }

  handleEvents(events: GameEvent[], world: WorldState): void {
    for (const event of events) {
      if (event.type === "enemy.hit") {
        const enemy = world.enemies.find((item) => item.id === event.enemyId);
        if (enemy) {
          this.addImpact(enemy.position, enemy.radius + 5, 0xf8fafc);
        }
      } else if (event.type === "enemy.killed") {
        this.addImpact(event.position, 18, 0xfacc15);
        this.addBurst(event.position, 0xfacc15);
      } else if (event.type === "player.damaged") {
        this.screenFlashAlpha = Math.max(this.screenFlashAlpha, 0.3 * this.flashIntensity);
        if (this.shakeIntensity > 0) {
          this.scene.cameras.main.shake(120, 0.003 * this.shakeIntensity);
        }
      } else if (event.type === "pickup.collected" && event.pickupKind === "heal") {
        this.addImpact(world.player.position, world.player.radius + 8, 0x4ade80);
      } else if (event.type === "player.level_up") {
        this.addImpact(world.player.position, world.player.radius + 12, 0x22d3ee);
        this.addBurst(world.player.position, 0x22d3ee);
      } else if (event.type === "encounter.warning.started") {
        this.addImpact(world.player.position, world.player.radius + 18, 0xfacc15);
      } else if (event.type === "encounter.started") {
        this.addImpact(world.player.position, world.player.radius + 22, 0xf97316);
        this.addBurst(world.player.position, 0xf97316);
      } else if (event.type === "contract.offered") {
        this.addImpact(world.player.position, world.player.radius + 18, 0x22d3ee);
      } else if (event.type === "game.over") {
        this.screenFlashAlpha = 0;
        this.scene.cameras.main.resetFX();
      }
    }
  }

  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.05));
    this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 1.9);

    for (const impact of this.impacts) {
      impact.age += dt;
    }
    for (const particle of this.particles) {
      particle.age += dt;
      particle.position.x += particle.velocity.x * dt;
      particle.position.y += particle.velocity.y * dt;
    }

    removeExpired(this.impacts);
    removeExpired(this.particles);
  }

  render(): void {
    const g = this.graphics;
    g.clear();

    for (const impact of this.impacts) {
      const t = impact.age / impact.lifetime;
      const alpha = Math.max(0, 1 - t);
      g.lineStyle(2, impact.color, alpha);
      g.strokeCircle(impact.position.x, impact.position.y, impact.radius + t * 14);
    }

    for (const particle of this.particles) {
      const alpha = Math.max(0, 1 - particle.age / particle.lifetime);
      g.fillStyle(particle.color, alpha);
      g.fillCircle(particle.position.x, particle.position.y, particle.radius);
    }

    if (this.screenFlashAlpha > 0) {
      const { width, height } = this.scene.scale.gameSize;
      g.fillStyle(0xff2f6d, this.screenFlashAlpha);
      g.fillRect(0, 0, width, height);
    }
  }

  reset(): void {
    this.impacts.length = 0;
    this.particles.length = 0;
    this.screenFlashAlpha = 0;
    this.graphics.clear();
    this.scene.cameras.main.resetFX();
  }

  getSnapshot(): FeedbackSnapshot {
    return {
      impactCount: this.impacts.length,
      particleCount: this.particles.length,
      screenFlashAlpha: this.screenFlashAlpha,
    };
  }

  celebrateRecord(position: Vec2): void {
    this.addImpact(position, 34, 0xfacc15);
    this.addBurst(position, 0xfacc15);
  }

  private addImpact(position: Vec2, radius: number, color: number): void {
    if (this.impacts.length >= MAX_IMPACTS) this.impacts.shift();
    this.impacts.push({
      position: { ...position },
      age: 0,
      lifetime: 0.18,
      radius,
      color,
    });
  }

  private addBurst(position: Vec2, color: number): void {
    const count = 8;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const speed = 95 + (index % 3) * 18;
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      this.particles.push({
        position: { ...position },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        age: 0,
        lifetime: 0.32,
        radius: 2.5,
        color,
      });
    }
  }
}

function removeExpired(items: Array<{ age: number; lifetime: number }>): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]!.age >= items[index]!.lifetime) {
      items.splice(index, 1);
    }
  }
}
