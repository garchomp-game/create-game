import Phaser from "phaser";
import type { GameEvent, Vec2, WorldState } from "../../domain/types";

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

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(14);
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
        this.screenFlashAlpha = Math.max(this.screenFlashAlpha, 0.3);
        this.scene.cameras.main.shake(120, 0.003);
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

  private addImpact(position: Vec2, radius: number, color: number): void {
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
