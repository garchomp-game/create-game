import * as Phaser from "phaser";
import { FINAL_COMMAND_SHIP_DEFINITION } from "../../content/bossCatalog";
import type { EncounterDirection } from "../../domain/encounterDirector";
import type {
  EnemyViewConfig,
  SimulationConfig,
  Vec2,
  ViewConfig,
  WorldState,
} from "../../domain/types";
import { getCollapseSafeBounds } from "../../simulation/systems/collapseSystem";
import { HUD_LEFT_PANEL_BOUNDS } from "./PhaserHud";

export class PhaserArenaWorldView {
  constructor(
    private readonly simulationConfig: SimulationConfig,
    private readonly viewConfig: ViewConfig,
  ) {}

  render(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
    pointerWorld: Vec2 | null,
  ): void {
    const { bullet, pickup, player } = this.viewConfig;

    graphics.clear();
    this.drawCollapse(graphics, world);
    this.drawPulseBoundaryField(graphics, world);
    this.drawExpeditionSituation(graphics, world);

    for (const obstacle of world.obstacles) {
      graphics.fillStyle(this.viewConfig.obstacle.fill, 1);
      graphics.fillRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        this.viewConfig.obstacle.radius,
      );
      graphics.lineStyle(2, this.viewConfig.obstacle.stroke, 1);
      graphics.strokeRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        this.viewConfig.obstacle.radius,
      );
    }

    for (const item of world.pickups) {
      if (item.kind === "heal") {
        this.drawHealPickup(graphics, item);
      } else {
        graphics.fillStyle(pickup.xpColor, 1);
        graphics.fillCircle(item.position.x, item.position.y, item.radius);
        graphics.lineStyle(2, 0x14532d, 1);
        graphics.strokeCircle(item.position.x, item.position.y, item.radius);
      }
    }

    for (const item of world.bullets) {
      const bounced = item.ricochetsUsed > 0;
      graphics.fillStyle(bounced ? 0x67e8f9 : bullet.color, 1);
      graphics.fillCircle(item.position.x, item.position.y, item.radius);
      if (item.ricochetRemaining > 0 || bounced) {
        graphics.lineStyle(2, 0x22d3ee, 0.95);
        graphics.strokeCircle(item.position.x, item.position.y, item.radius + 2);
      }
    }

    for (const item of world.enemyProjectiles) {
      this.drawEnemyProjectile(graphics, item);
    }

    for (const item of world.enemies) {
      this.drawEnemy(
        graphics,
        item,
        world.state.elapsed,
        world.expedition?.boss?.enemyId === item.id
          ? world.expedition.boss.phase
          : null,
      );
    }
    this.drawOffscreenEnemyIndicators(graphics, world);

    this.drawAimGuide(graphics, world, pointerWorld);
    graphics.fillStyle(player.color, 1);
    graphics.fillCircle(world.player.position.x, world.player.position.y, world.player.radius);
    graphics.lineStyle(2, player.stroke, 1);
    graphics.strokeCircle(world.player.position.x, world.player.position.y, world.player.radius);
  }

  renderCursor(
    graphics: Phaser.GameObjects.Graphics,
    pointerWorld: Vec2 | null,
  ): void {
    if (!pointerWorld) return;

    const { x, y } = pointerWorld;
    graphics.lineStyle(2, 0xf8fafc, 0.92);
    graphics.lineBetween(x - 12, y, x - 4, y);
    graphics.lineBetween(x + 4, y, x + 12, y);
    graphics.lineBetween(x, y - 12, x, y - 4);
    graphics.lineBetween(x, y + 4, x, y + 12);
    graphics.lineStyle(2, 0x38bdf8, 0.95);
    graphics.strokeCircle(x, y, 6);
    graphics.fillStyle(0xfacc15, 1);
    graphics.fillCircle(x, y, 2);
  }

  private drawPulseBoundaryField(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
  ): void {
    if (
      !this.simulationConfig.features.pulseBoundaryRicochet ||
      world.state.weaponType !== "pulse" ||
      world.runtime.ricochetBonus <= 0
    ) return;

    const { width, height } = this.simulationConfig.arena;
    const pulse = 0.42 + Math.sin(world.state.elapsed * 5) * 0.1;
    graphics.lineStyle(5, 0x22d3ee, pulse);
    graphics.strokeRect(4, 4, width - 8, height - 8);
    graphics.lineStyle(1, 0xa5f3fc, 0.8);
    graphics.strokeRect(8, 8, width - 16, height - 16);
  }

  private drawExpeditionSituation(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
  ): void {
    const expedition = world.expedition;
    if (!expedition) return;

    const actAge = Math.max(0, world.state.elapsed - expedition.actStartedAt);
    if (actAge <= 2.6) {
      const alpha = Math.max(0, 1 - actAge / 2.6);
      const { width, height } = this.simulationConfig.arena;
      const inset = 28 + actAge * 7;
      graphics.lineStyle(2, 0x5eead4, alpha * 0.55);
      graphics.strokeRect(
        inset,
        inset,
        Math.max(0, width - inset * 2),
        Math.max(0, height - inset * 2),
      );
      graphics.lineStyle(1, 0xfacc15, alpha * 0.42);
      graphics.strokeCircle(width / 2, height / 2, 66 + actAge * 22);
    }

    if (expedition.boss?.status === "active") {
      this.drawBossSituation(graphics, world);
      return;
    }

    const direction = expedition.currentDirection;
    const phase = expedition.director.phase;
    if (!direction || (phase !== "telegraph" && phase !== "active")) return;
    const directions =
      expedition.currentGeometryId === "pincer"
        ? [direction, oppositeDirection(direction)]
        : [direction];
    for (const ingressDirection of directions) {
      this.drawIngressDirection(
        graphics,
        ingressDirection,
        phase === "active",
      );
    }
  }

  private drawBossSituation(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
  ): void {
    const boss = world.expedition!.boss!;
    const enemy = world.enemies.find((candidate) => candidate.id === boss.enemyId);
    if (!enemy) return;

    if (boss.phaseChangedAt !== null) {
      const age = world.state.elapsed - boss.phaseChangedAt;
      if (age >= 0 && age <= 1.4) {
        const alpha = 1 - age / 1.4;
        graphics.lineStyle(4, 0xfb7185, alpha * 0.8);
        graphics.strokeCircle(
          enemy.position.x,
          enemy.position.y,
          enemy.radius + 16 + age * 38,
        );
      }
    }

    const action = boss.action;
    if (action.phase === "recovery") return;
    if (action.attackId === "escort-pincer" && action.ingressDirection) {
      this.drawIngressDirection(
        graphics,
        action.ingressDirection,
        action.phase === "execute",
      );
      this.drawIngressDirection(
        graphics,
        oppositeDirection(action.ingressDirection),
        action.phase === "execute",
      );
    }
    if (!action.aimDirection) return;

    const color = action.phase === "telegraph" ? 0xfacc15 : 0xf97316;
    const alpha = action.phase === "telegraph" ? 0.68 : 0.42;
    const spread =
      (action.attackId === "targeted-salvo"
        ? FINAL_COMMAND_SHIP_DEFINITION.targetedSalvo.spreadRadians[boss.phase - 1]
        : FINAL_COMMAND_SHIP_DEFINITION.escortPincer.suppressiveSalvo
            .spreadRadians[boss.phase - 1]) / 2;
    const directions = [
      rotateDirection(action.aimDirection, -spread),
      action.aimDirection,
      rotateDirection(action.aimDirection, spread),
    ];
    directions.forEach((direction, index) => {
      const start = {
        x: enemy.position.x + direction.x * (enemy.radius + 4),
        y: enemy.position.y + direction.y * (enemy.radius + 4),
      };
      graphics.lineStyle(index === 1 ? 3 : 2, color, index === 1 ? alpha : alpha * 0.72);
      graphics.lineBetween(
        start.x,
        start.y,
        start.x + direction.x * 720,
        start.y + direction.y * 720,
      );
    });
  }

  private drawIngressDirection(
    graphics: Phaser.GameObjects.Graphics,
    direction: EncounterDirection,
    active: boolean,
  ): void {
    const { width, height } = this.simulationConfig.arena;
    const color = active ? 0xf97316 : 0xfacc15;
    const band = 22;
    graphics.fillStyle(color, active ? 0.055 : 0.085);
    if (direction === "north") graphics.fillRect(0, 0, width, band);
    else if (direction === "south") graphics.fillRect(0, height - band, width, band);
    else if (direction === "west") graphics.fillRect(0, 0, band, height);
    else graphics.fillRect(width - band, 0, band, height);

    graphics.lineStyle(active ? 2 : 3, color, active ? 0.42 : 0.78);
    const count = direction === "north" || direction === "south" ? 9 : 5;
    for (let index = 1; index <= count; index += 1) {
      const along =
        (index / (count + 1)) *
        (direction === "north" || direction === "south" ? width : height);
      const depth = active ? 13 : 18;
      const half = active ? 6 : 8;
      if (direction === "north") {
        graphics.lineBetween(along - half, 6, along, depth);
        graphics.lineBetween(along + half, 6, along, depth);
      } else if (direction === "south") {
        graphics.lineBetween(along - half, height - 6, along, height - depth);
        graphics.lineBetween(along + half, height - 6, along, height - depth);
      } else if (direction === "west") {
        graphics.lineBetween(6, along - half, depth, along);
        graphics.lineBetween(6, along + half, depth, along);
      } else {
        graphics.lineBetween(width - 6, along - half, width - depth, along);
        graphics.lineBetween(width - 6, along + half, width - depth, along);
      }
    }
  }

  private drawCollapse(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
  ): void {
    const inset = world.encounter.collapse.inset;
    if (inset <= 0) return;
    const { width, height } = this.simulationConfig.arena;
    const bounds = getCollapseSafeBounds(this.simulationConfig, inset);

    graphics.fillStyle(0x7f1d1d, 0.34);
    graphics.fillRect(0, 0, width, Math.min(height, inset));
    graphics.fillRect(0, Math.max(0, height - inset), width, Math.min(height, inset));
    const middleHeight = Math.max(0, height - inset * 2);
    graphics.fillRect(0, inset, Math.min(width, inset), middleHeight);
    graphics.fillRect(
      Math.max(0, width - inset),
      inset,
      Math.min(width, inset),
      middleHeight,
    );

    if (bounds.right > bounds.left && bounds.bottom > bounds.top) {
      graphics.lineStyle(3, 0xfca5a5, 0.9);
      graphics.strokeRect(
        bounds.left + 1.5,
        bounds.top + 1.5,
        Math.max(0, bounds.right - bounds.left - 3),
        Math.max(0, bounds.bottom - bounds.top - 3),
      );
    }
  }

  private drawAimGuide(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
    pointerWorld: Vec2 | null,
  ): void {
    if (world.state.status === "title" || world.state.status === "gameOver") return;

    const aimDirection = this.resolveAimDirection(world, pointerWorld);
    const start = {
      x: world.player.position.x + aimDirection.x * (world.player.radius + 6),
      y: world.player.position.y + aimDirection.y * (world.player.radius + 6),
    };
    const end = pointerWorld ?? {
      x: world.player.position.x + aimDirection.x * 180,
      y: world.player.position.y + aimDirection.y * 180,
    };
    graphics.lineStyle(2, 0x38bdf8, 0.62);
    graphics.lineBetween(start.x, start.y, end.x, end.y);
    graphics.lineStyle(1, 0xf8fafc, 0.34);
    graphics.strokeCircle(end.x, end.y, 14);
  }

  private resolveAimDirection(world: WorldState, pointerWorld: Vec2 | null): Vec2 {
    if (!pointerWorld) return world.state.lastAim;

    const dx = pointerWorld.x - world.player.position.x;
    const dy = pointerWorld.y - world.player.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return world.state.lastAim;

    return { x: dx / distance, y: dy / distance };
  }

  private drawEnemy(
    graphics: Phaser.GameObjects.Graphics,
    enemy: WorldState["enemies"][number],
    elapsed: number,
    bossPhase: 1 | 2 | null,
  ): void {
    const view = this.viewConfig.enemy[enemy.typeId];
    const { x, y } = enemy.position;
    const r = enemy.radius;

    if (enemy.boss) {
      this.drawCommandShip(graphics, enemy, elapsed, bossPhase ?? 1);
      if (
        (enemy.pulseFocusStacks ?? 0) > 0 &&
        (enemy.pulseFocusExpiresAt ?? 0) >= elapsed
      ) {
        this.drawPulseFocusPips(graphics, x, y - r - 14, enemy.pulseFocusStacks ?? 0);
      }
      return;
    }

    if (view.shape === "circle") {
      graphics.fillStyle(view.color, 1);
      graphics.fillCircle(x, y, r);
      graphics.lineStyle(2, view.stroke, 1);
      graphics.strokeCircle(x, y, r);
    } else if (view.shape === "square") {
      graphics.fillStyle(view.color, 1);
      graphics.fillRect(x - r, y - r, r * 2, r * 2);
      graphics.lineStyle(2, view.stroke, 1);
      graphics.strokeRect(x - r, y - r, r * 2, r * 2);
    } else if (view.shape === "diamond") {
      this.drawPolygon(
        graphics,
        [
          { x, y: y - r * 1.18 },
          { x: x + r * 1.18, y },
          { x, y: y + r * 1.18 },
          { x: x - r * 1.18, y },
        ],
        view.color,
        view.stroke,
      );
    } else if (view.shape === "triangle") {
      this.drawPolygon(
        graphics,
        this.getRegularPolygonPoints(x, y, r * 1.25, 3, -Math.PI / 2),
        view.color,
        view.stroke,
      );
    } else {
      this.drawPolygon(
        graphics,
        this.getRegularPolygonPoints(x, y, r * 1.08, 6, Math.PI / 6),
        view.color,
        view.stroke,
      );
    }

    this.drawEnemyMark(graphics, enemy, view);
    if (enemy.elite?.kind === "commander") {
      this.drawCommanderEliteMark(graphics, enemy, elapsed);
    }
    if (enemy.action?.kind === "charger") {
      this.drawChargerAction(graphics, enemy, elapsed);
    }
    if (
      (enemy.pulseFocusStacks ?? 0) > 0 &&
      (enemy.pulseFocusExpiresAt ?? 0) >= elapsed
    ) {
      this.drawPulseFocusPips(graphics, x, y - r - 7, enemy.pulseFocusStacks ?? 0);
    }
  }

  private drawCommandShip(
    graphics: Phaser.GameObjects.Graphics,
    enemy: WorldState["enemies"][number],
    elapsed: number,
    phase: 1 | 2,
  ): void {
    const { x, y } = enemy.position;
    const radius = enemy.radius;
    const accent = phase === 2 ? 0xfb7185 : 0xfacc15;
    const wing = [
      { x: x - radius * 1.65, y: y - radius * 0.25 },
      { x: x - radius * 0.55, y: y - radius * 0.72 },
      { x: x + radius * 0.55, y: y - radius * 0.72 },
      { x: x + radius * 1.65, y: y - radius * 0.25 },
      { x: x + radius * 1.25, y: y + radius * 0.62 },
      { x: x, y: y + radius * 0.9 },
      { x: x - radius * 1.25, y: y + radius * 0.62 },
    ];
    this.drawPolygon(graphics, wing, 0x3f1d4b, accent);
    this.drawPolygon(
      graphics,
      this.getRegularPolygonPoints(x, y, radius, 6, Math.PI / 6),
      0x172554,
      0xf8fafc,
    );
    graphics.lineStyle(3, accent, 0.92);
    graphics.strokeCircle(x, y, radius * 0.55);
    graphics.fillStyle(phase === 2 ? 0xfda4af : 0xfef3c7, 1);
    graphics.fillCircle(x, y, radius * 0.24);
    graphics.lineStyle(2, 0x67e8f9, 0.8);
    const ring = this.getRegularPolygonPoints(
      x,
      y,
      radius + 10,
      8,
      elapsed * 0.22,
    );
    this.tracePolygon(graphics, ring);
    graphics.strokePath();
    graphics.lineStyle(3, accent, 0.95);
    graphics.lineBetween(x - radius * 1.5, y, x - radius * 0.72, y);
    graphics.lineBetween(x + radius * 0.72, y, x + radius * 1.5, y);
  }

  private drawPulseFocusPips(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    y: number,
    stackCount: number,
  ): void {
    const count = Math.max(0, Math.min(4, stackCount));
    const spacing = 7;
    const startX = centerX - ((count - 1) * spacing) / 2;
    for (let index = 0; index < count; index += 1) {
      graphics.fillStyle(index === count - 1 ? 0xfacc15 : 0x22d3ee, 1);
      graphics.fillCircle(startX + index * spacing, y, 2.5);
      graphics.lineStyle(1, 0xf8fafc, 0.9);
      graphics.strokeCircle(startX + index * spacing, y, 3.5);
    }
  }

  private drawOffscreenEnemyIndicators(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
  ): void {
    if (world.state.status !== "playing" && world.state.status !== "paused") return;

    const visibleLimit = 8;
    const offscreenEnemies = world.enemies
      .filter((enemy) => this.isOffscreen(enemy))
      .sort((left, right) =>
        this.distanceToPlayer(world, left) - this.distanceToPlayer(world, right),
      )
      .slice(0, visibleLimit);

    for (const enemy of offscreenEnemies) {
      this.drawOffscreenEnemyIndicator(graphics, world, enemy);
    }
  }

  private isOffscreen(enemy: WorldState["enemies"][number]): boolean {
    const { width, height } = this.simulationConfig.arena;
    return (
      enemy.position.x < 0 ||
      enemy.position.x > width ||
      enemy.position.y < 0 ||
      enemy.position.y > height
    );
  }

  private distanceToPlayer(
    world: WorldState,
    enemy: WorldState["enemies"][number],
  ): number {
    return Math.hypot(
      world.player.position.x - enemy.position.x,
      world.player.position.y - enemy.position.y,
    );
  }

  private drawOffscreenEnemyIndicator(
    graphics: Phaser.GameObjects.Graphics,
    world: WorldState,
    enemy: WorldState["enemies"][number],
  ): void {
    const center = this.getOffscreenIndicatorCenter(enemy);
    const dx = world.player.position.x - enemy.position.x;
    const dy = world.player.position.y - enemy.position.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const direction = { x: dx / distance, y: dy / distance };
    const perpendicular = { x: -direction.y, y: direction.x };
    const size = 11;
    const spread = 7;
    const tail = 7;
    const points = [
      {
        x: center.x + direction.x * size,
        y: center.y + direction.y * size,
      },
      {
        x: center.x - direction.x * tail + perpendicular.x * spread,
        y: center.y - direction.y * tail + perpendicular.y * spread,
      },
      {
        x: center.x - direction.x * tail - perpendicular.x * spread,
        y: center.y - direction.y * tail - perpendicular.y * spread,
      },
    ];
    const view = this.viewConfig.enemy[enemy.typeId];

    graphics.fillStyle(0x020617, 0.72);
    graphics.fillCircle(center.x, center.y, 15);
    this.drawPolygon(graphics, points, view.color, 0xf8fafc);
    graphics.lineStyle(1, view.stroke, 0.95);
    graphics.strokeCircle(center.x, center.y, 15);
    if (enemy.elite?.kind === "commander") {
      graphics.lineStyle(2, 0xfacc15, 1);
      graphics.strokeCircle(center.x, center.y, 18);
    }
  }

  private getOffscreenIndicatorCenter(enemy: WorldState["enemies"][number]): Vec2 {
    const { width, height } = this.simulationConfig.arena;
    const padding = 18;
    const hud = HUD_LEFT_PANEL_BOUNDS;
    const margin = 16;
    const center = {
      x: Math.max(padding, Math.min(width - padding, enemy.position.x)),
      y: Math.max(padding, Math.min(height - padding, enemy.position.y)),
    };

    if (!this.overlapsHud(center, hud, margin)) return center;

    if (enemy.position.y < 0) {
      return { x: hud.x + hud.width + margin + 15, y: center.y };
    }
    if (enemy.position.x < 0) {
      return { x: center.x, y: hud.y + hud.height + margin + 15 };
    }

    return center;
  }

  private overlapsHud(
    position: Vec2,
    hud: { x: number; y: number; width: number; height: number },
    margin: number,
  ): boolean {
    return (
      position.x >= hud.x - margin &&
      position.x <= hud.x + hud.width + margin &&
      position.y >= hud.y - margin &&
      position.y <= hud.y + hud.height + margin
    );
  }

  private drawHealPickup(
    graphics: Phaser.GameObjects.Graphics,
    pickup: WorldState["pickups"][number],
  ): void {
    const view = this.viewConfig.pickup;
    const { x, y } = pickup.position;
    const size = pickup.radius * 2.25;
    const left = x - size / 2;
    const top = y - size / 2;
    const crossLong = pickup.radius * 1.22;
    const crossShort = Math.max(3, pickup.radius * 0.38);

    graphics.fillStyle(view.healFill, 1);
    graphics.fillRoundedRect(left, top, size, size, 3);
    graphics.lineStyle(2, view.healStroke, 1);
    graphics.strokeRoundedRect(left, top, size, size, 3);
    graphics.fillStyle(view.healCross, 1);
    graphics.fillRect(x - crossShort / 2, y - crossLong / 2, crossShort, crossLong);
    graphics.fillRect(x - crossLong / 2, y - crossShort / 2, crossLong, crossShort);
  }

  private drawEnemyMark(
    graphics: Phaser.GameObjects.Graphics,
    enemy: WorldState["enemies"][number],
    view: EnemyViewConfig,
  ): void {
    const { x, y } = enemy.position;
    const r = enemy.radius;
    graphics.lineStyle(2, view.markColor, 0.95);

    if (view.mark === "ring") {
      graphics.strokeCircle(x, y, r * 0.48);
    } else if (view.mark === "cross") {
      graphics.lineBetween(x - r * 0.5, y, x + r * 0.5, y);
      graphics.lineBetween(x, y - r * 0.5, x, y + r * 0.5);
    } else if (view.mark === "slash") {
      graphics.lineStyle(3, view.markColor, 0.95);
      graphics.lineBetween(x - r * 0.48, y + r * 0.36, x + r * 0.48, y - r * 0.36);
    } else {
      graphics.fillStyle(view.markColor, 1);
      graphics.fillCircle(x, y, r * 0.28);
      graphics.lineStyle(1, view.stroke, 0.85);
      graphics.strokeCircle(x, y, r * 0.28);
    }
  }

  private drawCommanderEliteMark(
    graphics: Phaser.GameObjects.Graphics,
    enemy: WorldState["enemies"][number],
    elapsed: number,
  ): void {
    const { x, y } = enemy.position;
    const radius = enemy.radius + 6;
    const telegraphing = enemy.elite?.phase === "telegraph";
    const pulse = 0.72 + Math.sin(elapsed * 8) * 0.18;
    graphics.lineStyle(telegraphing ? 4 : 3, 0xfacc15, telegraphing ? pulse : 0.95);
    graphics.strokeCircle(x, y, radius);
    this.drawPolygon(
      graphics,
      this.getRegularPolygonPoints(x, y, radius + 4, 6, Math.PI / 6),
      0x4c1d57,
      0xfacc15,
    );
    graphics.fillStyle(0xfef3c7, 1);
    graphics.fillCircle(x, y, Math.max(4, enemy.radius * 0.3));
    graphics.lineStyle(2, 0xfb7185, 0.95);
    graphics.strokeCircle(x, y, Math.max(7, enemy.radius * 0.48));
    graphics.lineStyle(3, 0xfacc15, 0.9);
    graphics.lineBetween(x - radius - 10, y, x - radius + 1, y);
    graphics.lineBetween(x + radius - 1, y, x + radius + 10, y);
    graphics.lineStyle(2, 0xfffbeb, 0.95);
    graphics.lineBetween(x - 8, y - radius - 5, x, y - radius - 12);
    graphics.lineBetween(x, y - radius - 12, x + 8, y - radius - 5);
    graphics.lineBetween(x - 8, y - radius - 5, x + 8, y - radius - 5);
    if (telegraphing) {
      for (let index = 0; index < 4; index += 1) {
        const angle = (Math.PI * 2 * index) / 4 + elapsed * 0.8;
        graphics.lineBetween(
          x + Math.cos(angle) * (radius + 2),
          y + Math.sin(angle) * (radius + 2),
          x + Math.cos(angle) * (radius + 10),
          y + Math.sin(angle) * (radius + 10),
        );
      }
    }
  }

  private drawChargerAction(
    graphics: Phaser.GameObjects.Graphics,
    enemy: WorldState["enemies"][number],
    elapsed: number,
  ): void {
    const action = enemy.action!;
    const { x, y } = enemy.position;
    const radius = enemy.radius + 5;
    graphics.lineStyle(2, 0xfef08a, 0.95);
    graphics.strokeCircle(x, y, radius);
    const facing = action.chargeDirection ?? { x: 1, y: 0 };
    const perpendicular = { x: -facing.y, y: facing.x };
    const rear = {
      x: x - facing.x * (radius - 1),
      y: y - facing.y * (radius - 1),
    };
    graphics.lineStyle(2, 0xfb7185, 0.9);
    graphics.lineBetween(
      rear.x - facing.x * 8 + perpendicular.x * 6,
      rear.y - facing.y * 8 + perpendicular.y * 6,
      rear.x,
      rear.y,
    );
    graphics.lineBetween(
      rear.x - facing.x * 8 - perpendicular.x * 6,
      rear.y - facing.y * 8 - perpendicular.y * 6,
      rear.x,
      rear.y,
    );

    const direction = action.chargeDirection;
    if (!direction) return;
    const warning = action.phase === "telegraph" || action.phase === "prepare";
    if (warning) {
      const segmentLength = 28;
      const gap = 11;
      const alpha = action.phase === "prepare"
        ? 0.95
        : 0.55 + Math.sin(elapsed * 12) * 0.2;
      graphics.lineStyle(action.phase === "prepare" ? 4 : 3, 0xfb7185, alpha);
      for (let index = 0; index < 7; index += 1) {
        const startDistance = radius + 4 + index * (segmentLength + gap);
        const endDistance = startDistance + segmentLength;
        graphics.lineBetween(
          x + direction.x * startDistance,
          y + direction.y * startDistance,
          x + direction.x * endDistance,
          y + direction.y * endDistance,
        );
      }
      const tipDistance = radius + 7 * (segmentLength + gap);
      const perpendicular = { x: -direction.y, y: direction.x };
      graphics.lineBetween(
        x + direction.x * tipDistance,
        y + direction.y * tipDistance,
        x + direction.x * (tipDistance - 14) + perpendicular.x * 8,
        y + direction.y * (tipDistance - 14) + perpendicular.y * 8,
      );
      graphics.lineBetween(
        x + direction.x * tipDistance,
        y + direction.y * tipDistance,
        x + direction.x * (tipDistance - 14) - perpendicular.x * 8,
        y + direction.y * (tipDistance - 14) - perpendicular.y * 8,
      );
    } else if (action.phase === "charge") {
      graphics.lineStyle(5, 0xfacc15, 0.72);
      graphics.lineBetween(
        x - direction.x * (radius + 34),
        y - direction.y * (radius + 34),
        x - direction.x * radius,
        y - direction.y * radius,
      );
    } else if (action.phase === "recovery") {
      graphics.lineStyle(3, 0x94a3b8, 0.85);
      graphics.lineBetween(x - radius, y - radius, x + radius, y + radius);
      graphics.lineBetween(x + radius, y - radius, x - radius, y + radius);
    }
  }

  private drawEnemyProjectile(
    graphics: Phaser.GameObjects.Graphics,
    projectile: WorldState["enemyProjectiles"][number],
  ): void {
    const { x, y } = projectile.position;
    const r = projectile.radius + 3;
    const view = this.viewConfig.enemyProjectile;
    const bossProjectile = Boolean(projectile.source?.bossAttackId);
    this.drawPolygon(
      graphics,
      [
        { x, y: y - r },
        { x: x + r, y },
        { x, y: y + r },
        { x: x - r, y },
      ],
      bossProjectile ? 0x9f1239 : view.color,
      bossProjectile ? 0xfef08a : view.stroke,
    );
    graphics.lineStyle(1, view.core, 0.95);
    graphics.lineBetween(x - r * 0.45, y, x + r * 0.45, y);
    graphics.lineBetween(x, y - r * 0.45, x, y + r * 0.45);
    graphics.fillStyle(view.core, 1);
    graphics.fillCircle(x, y, Math.max(2, projectile.radius * 0.35));
    if (bossProjectile) {
      graphics.lineStyle(2, 0xfb7185, 0.9);
      graphics.strokeCircle(x, y, r + 3);
    }
  }

  private drawPolygon(
    graphics: Phaser.GameObjects.Graphics,
    points: Vec2[],
    fillColor: number,
    strokeColor: number,
  ): void {
    graphics.fillStyle(fillColor, 1);
    this.tracePolygon(graphics, points);
    graphics.fillPath();
    graphics.lineStyle(2, strokeColor, 1);
    this.tracePolygon(graphics, points);
    graphics.strokePath();
  }

  private tracePolygon(
    graphics: Phaser.GameObjects.Graphics,
    points: Vec2[],
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

  private getRegularPolygonPoints(
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
}

function oppositeDirection(direction: EncounterDirection): EncounterDirection {
  const directions: EncounterDirection[] = ["north", "east", "south", "west"];
  return directions[(directions.indexOf(direction) + 2) % directions.length]!;
}

function rotateDirection(direction: Vec2, radians: number): Vec2 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: direction.x * cosine - direction.y * sine,
    y: direction.x * sine + direction.y * cosine,
  };
}
