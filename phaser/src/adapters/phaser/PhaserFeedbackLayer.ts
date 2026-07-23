import * as Phaser from "phaser";
import { EX_PROTOCOL_CATALOG } from "../../content/exProtocolCatalog";
import type { ProfileSettings } from "../../domain/profile";
import type { GameEvent, Vec2, WorldState } from "../../domain/types";

const MAX_IMPACTS = 64;
const MAX_PARTICLES = 256;
const MAX_PROTOCOL_EFFECTS = 24;

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

type ProtocolEffect =
  | {
      kind: "cone";
      origin: Vec2;
      direction: Vec2;
      range: number;
      arcRadians: number;
      color: number;
      age: number;
      lifetime: number;
    }
  | {
      kind: "line";
      start: Vec2;
      end: Vec2;
      blocked: boolean;
      color: number;
      age: number;
      lifetime: number;
    }
  | {
      kind: "guard";
      position: Vec2;
      side: "left" | "right";
      color: number;
      age: number;
      lifetime: number;
    };

export type FeedbackSnapshot = {
  impactCount: number;
  particleCount: number;
  protocolEffectCount: number;
  screenFlashAlpha: number;
};

export class PhaserFeedbackLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly impacts: ImpactRing[] = [];
  private readonly particles: BurstParticle[] = [];
  private readonly protocolEffects: ProtocolEffect[] = [];
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
      if (
        event.type === "enemy.hit" ||
        event.type === "enemy.protocol.hit"
      ) {
        const enemy = world.enemies.find((item) => item.id === event.enemyId);
        if (enemy) {
          this.addImpact(enemy.position, enemy.radius + 5, 0xf8fafc);
        }
      } else if (
        event.type === "enemy.killed" ||
        event.type === "enemy.protocol.killed"
      ) {
        this.addImpact(event.position, 18, 0xfacc15);
        this.addBurst(event.position, 0xfacc15);
      } else if (event.type === "player.damaged") {
        this.screenFlashAlpha = Math.max(this.screenFlashAlpha, 0.3 * this.flashIntensity);
        if (this.shakeIntensity > 0) {
          this.scene.cameras.main.shake(120, 0.003 * this.shakeIntensity);
        }
      } else if (event.type === "pickup.collected" && event.pickupKind === "heal") {
        this.addImpact(world.player.position, world.player.radius + 8, 0x4ade80);
      } else if (event.type === "player.level_up" || event.type === "extra.level_up") {
        this.addImpact(world.player.position, world.player.radius + 12, 0x22d3ee);
        this.addBurst(world.player.position, 0x22d3ee);
      } else if (event.type === "encounter.warning.started") {
        this.addImpact(world.player.position, world.player.radius + 18, 0xfacc15);
      } else if (event.type === "encounter.started") {
        this.addImpact(world.player.position, world.player.radius + 22, 0xf97316);
        this.addBurst(world.player.position, 0xf97316);
      } else if (event.type === "expedition.act.changed") {
        this.addImpact(world.player.position, world.player.radius + 26, 0x5eead4);
        this.addBurst(world.player.position, 0x5eead4);
      } else if (event.type === "expedition.encounter.selected") {
        this.addImpact(world.player.position, world.player.radius + 20, 0xfacc15);
      } else if (event.type === "expedition.encounter.active.started") {
        this.addImpact(world.player.position, world.player.radius + 24, 0xf97316);
        this.addBurst(world.player.position, 0xf97316);
      } else if (event.type === "boss.spawned") {
        this.addImpact(event.position, 62, 0xfacc15);
        this.addBurst(event.position, 0xfacc15);
      } else if (event.type === "boss.attack.telegraphed") {
        const enemy = world.enemies.find((item) => item.id === event.enemyId);
        if (enemy) this.addImpact(enemy.position, enemy.radius + 16, 0xfacc15);
      } else if (event.type === "boss.phase.changed") {
        const enemy = world.enemies.find((item) => item.id === event.enemyId);
        if (enemy) {
          this.addImpact(enemy.position, enemy.radius + 24, 0xfb7185);
          this.addBurst(enemy.position, 0xfb7185);
        }
      } else if (event.type === "boss.defeated") {
        this.addImpact(event.position, 78, 0x67e8f9);
        this.addBurst(event.position, 0xfacc15);
      } else if (event.type === "elite.commander.reinforcement.telegraphed") {
        this.addImpact(event.position, 28, 0xfacc15);
      } else if (event.type === "elite.commander.reinforcement.deployed") {
        this.addImpact(event.position, 34, 0xf97316);
        this.addBurst(event.position, 0xf97316);
      } else if (event.type === "elite.commander.pressure.lowered") {
        this.addImpact(event.position, 38, 0x22d3ee);
        this.addBurst(event.position, 0x22d3ee);
      } else if (event.type === "enemy.charger.telegraph.started") {
        this.addImpact(event.position, 24, 0xfb7185);
      } else if (event.type === "enemy.charger.charge.started") {
        this.addImpact(event.position, 28, 0xfacc15);
        this.addBurst(event.position, 0xfacc15);
      } else if (event.type === "enemy.charger.charge.ended") {
        this.addImpact(event.position, 30, event.hitPlayer ? 0xef4444 : 0x22d3ee);
      } else if (event.type === "contract.offered") {
        this.addImpact(world.player.position, world.player.radius + 18, 0x22d3ee);
      } else if (event.type === "spread.sweep.triggered") {
        this.addImpact(world.player.position, world.player.radius + 14, 0xfbbf24);
        this.addBurst(world.player.position, 0xfbbf24);
      } else if (event.type === "bullet.ricocheted") {
        this.addImpact(
          event.position,
          event.surfaceKind === "arenaBoundary" ? 10 : 7,
          event.surfaceKind === "arenaBoundary" ? 0x22d3ee : 0xe2e8f0,
        );
      } else if (event.type === "ex.protocol.selected") {
        const color = protocolColor(event.protocolId);
        this.addImpact(world.player.position, world.player.radius + 20, color);
        this.addBurst(world.player.position, color);
      } else if (
        event.type === "ex.evolution.selected" ||
        event.type === "ex.mastery.unlocked" ||
        event.type === "ex.limit_break.connected"
      ) {
        const color =
          event.type === "ex.limit_break.connected"
            ? 0xf8fafc
            : protocolColor(event.protocolId);
        this.addImpact(world.player.position, world.player.radius + 16, color);
      } else if (event.type === "ex.special.armed") {
        this.addImpact(world.player.position, world.player.radius + 13, 0xf59e0b);
      } else if (
        event.type === "ex.special.rejected" ||
        event.type === "ex.special.expired"
      ) {
        this.addImpact(world.player.position, world.player.radius + 9, 0xfb7185);
      } else if (event.type === "ex.rebound.restored") {
        for (const bullet of world.bullets) {
          if (bullet.volleyId === event.volleyId) {
            this.addImpact(bullet.position, bullet.radius + 7, 0xfbbf24);
          }
        }
      } else if (event.type === "ex.redline.hit") {
        const bullet = world.bullets.find(({ id }) => id === event.projectileId);
        this.addImpact(
          bullet?.position ?? world.player.position,
          (bullet?.radius ?? world.player.radius) + 8,
          0xfb7185,
        );
      } else if (event.type === "ex.relay.anchor.created") {
        const enemy = world.enemies.find(({ id }) => id === event.enemyId);
        if (enemy) this.addImpact(enemy.position, enemy.radius + 9, 0xc4b5fd);
      } else if (event.type === "ex.relay.blocked") {
        const anchor = world.enemies.find(
          ({ id }) => id === event.anchorEnemyId,
        );
        const endpoint = world.enemies.find(
          ({ id }) => id === event.endpointEnemyId,
        );
        if (anchor && endpoint) {
          this.addProtocolLine(
            anchor.position,
            endpoint.position,
            0xfb7185,
            true,
          );
        }
      } else if (event.type === "ex.relay.resolved") {
        this.addImpact(world.player.position, world.player.radius + 12, 0xa78bfa);
      } else if (
        event.type === "ex.tidal.charged" ||
        event.type === "ex.breakwater.charged"
      ) {
        this.addImpact(world.player.position, world.player.radius + 12, 0x2dd4bf);
      } else if (event.type === "ex.special.activated") {
        this.addSpecialActivation(event.protocolId, world);
      } else if (event.type === "ex.breakwater.resolved") {
        if (event.targetCount > 0) this.addBurst(world.player.position, 0xf97316);
      } else if (event.type === "ex.aegis.intercepted") {
        this.addProtocolGuard(world.player.position, event.side);
      } else if (event.type === "ex.aegis.perfect-guard.charged") {
        this.addImpact(world.player.position, world.player.radius + 15, 0x93c5fd);
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
    for (const effect of this.protocolEffects) {
      effect.age += dt;
    }

    removeExpired(this.impacts);
    removeExpired(this.particles);
    removeExpired(this.protocolEffects);
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
    for (const effect of this.protocolEffects) {
      const alpha = Math.max(0, 1 - effect.age / effect.lifetime);
      if (effect.kind === "cone") {
        const angle = Math.atan2(effect.direction.y, effect.direction.x);
        const halfArc = effect.arcRadians / 2;
        const left = {
          x: Math.cos(angle - halfArc),
          y: Math.sin(angle - halfArc),
        };
        const right = {
          x: Math.cos(angle + halfArc),
          y: Math.sin(angle + halfArc),
        };
        g.lineStyle(2, effect.color, alpha * 0.82);
        g.lineBetween(
          effect.origin.x,
          effect.origin.y,
          effect.origin.x + left.x * effect.range,
          effect.origin.y + left.y * effect.range,
        );
        g.lineBetween(
          effect.origin.x,
          effect.origin.y,
          effect.origin.x + right.x * effect.range,
          effect.origin.y + right.y * effect.range,
        );
        g.beginPath();
        g.arc(
          effect.origin.x,
          effect.origin.y,
          effect.range,
          angle - halfArc,
          angle + halfArc,
          false,
        );
        g.strokePath();
      } else if (effect.kind === "line") {
        g.lineStyle(effect.blocked ? 2 : 3, effect.color, alpha * 0.88);
        g.lineBetween(
          effect.start.x,
          effect.start.y,
          effect.end.x,
          effect.end.y,
        );
        if (effect.blocked) {
          const center = {
            x: (effect.start.x + effect.end.x) / 2,
            y: (effect.start.y + effect.end.y) / 2,
          };
          g.lineStyle(3, 0xf8fafc, alpha);
          g.lineBetween(center.x - 7, center.y - 7, center.x + 7, center.y + 7);
          g.lineBetween(center.x + 7, center.y - 7, center.x - 7, center.y + 7);
        }
      } else {
        const direction = effect.side === "left" ? -1 : 1;
        g.lineStyle(3, effect.color, alpha);
        g.beginPath();
        g.arc(
          effect.position.x,
          effect.position.y,
          24,
          direction < 0 ? Math.PI * 0.55 : -Math.PI * 0.45,
          direction < 0 ? Math.PI * 1.45 : Math.PI * 0.45,
          direction > 0,
        );
        g.strokePath();
      }
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
    this.protocolEffects.length = 0;
    this.screenFlashAlpha = 0;
    this.graphics.clear();
    this.scene.cameras.main.resetFX();
  }

  getSnapshot(): FeedbackSnapshot {
    return {
      impactCount: this.impacts.length,
      particleCount: this.particles.length,
      protocolEffectCount: this.protocolEffects.length,
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

  private addSpecialActivation(
    protocolId: string,
    world: WorldState,
  ): void {
    const progression = world.progression.exProtocol;
    if (progression?.status !== "selected") return;
    if (protocolId === EX_PROTOCOL_CATALOG.protocols[3].id) {
      const wideWake = EX_PROTOCOL_CATALOG.protocols[3].evolutionOne[0];
      const arcRadians =
        progression.route.evolutionOneId === wideWake.id
          ? wideWake.arcRadians
          : EX_PROTOCOL_CATALOG.protocols[3].signature.arcRadians;
      this.addProtocolCone(
        world.player.position,
        world.state.lastAim,
        220,
        arcRadians,
        0x2dd4bf,
      );
      return;
    }
    if (protocolId === EX_PROTOCOL_CATALOG.protocols[4].id) {
      const longBreak = EX_PROTOCOL_CATALOG.protocols[4].evolutionTwo[0];
      const wideBreak = EX_PROTOCOL_CATALOG.protocols[4].evolutionTwo[1];
      const range =
        progression.route.evolutionTwoId === longBreak.id
          ? longBreak.rangePx
          : EX_PROTOCOL_CATALOG.protocols[4].signature.rangePx;
      const arcRadians =
        progression.route.evolutionTwoId === wideBreak.id
          ? degreesToRadians(wideBreak.coneAngleDegrees)
          : degreesToRadians(
              EX_PROTOCOL_CATALOG.protocols[4].signature.coneAngleDegrees,
            );
      this.addProtocolCone(
        world.player.position,
        world.state.lastAim,
        range,
        arcRadians,
        0xf97316,
      );
    }
  }

  private addProtocolCone(
    origin: Vec2,
    direction: Vec2,
    range: number,
    arcRadians: number,
    color: number,
  ): void {
    this.addProtocolEffect({
      kind: "cone",
      origin: { ...origin },
      direction: normalized(direction),
      range,
      arcRadians,
      color,
      age: 0,
      lifetime: 0.28,
    });
  }

  private addProtocolLine(
    start: Vec2,
    end: Vec2,
    color: number,
    blocked: boolean,
  ): void {
    this.addProtocolEffect({
      kind: "line",
      start: { ...start },
      end: { ...end },
      color,
      blocked,
      age: 0,
      lifetime: 0.34,
    });
  }

  private addProtocolGuard(position: Vec2, side: "left" | "right"): void {
    this.addProtocolEffect({
      kind: "guard",
      position: { ...position },
      side,
      color: 0x93c5fd,
      age: 0,
      lifetime: 0.24,
    });
  }

  private addProtocolEffect(effect: ProtocolEffect): void {
    if (this.protocolEffects.length >= MAX_PROTOCOL_EFFECTS) {
      this.protocolEffects.shift();
    }
    this.protocolEffects.push(effect);
  }
}

function removeExpired(items: Array<{ age: number; lifetime: number }>): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]!.age >= items[index]!.lifetime) {
      items.splice(index, 1);
    }
  }
}

function protocolColor(protocolId: string): number {
  if (protocolId.includes("resonance")) return 0xa78bfa;
  if (protocolId.includes("rebound")) return 0xf59e0b;
  if (protocolId.includes("redline")) return 0xfb7185;
  if (protocolId.includes("tidal")) return 0x2dd4bf;
  if (protocolId.includes("breakwater")) return 0xf97316;
  return 0x60a5fa;
}

function normalized(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= Number.EPSILON) return { x: 1, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
