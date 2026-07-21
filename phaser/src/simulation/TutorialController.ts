import type {
  EnemyProjectile,
  GameEvent,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../domain/types";
import type {
  TutorialSnapshot,
  TutorialStepId,
  TutorialTarget,
} from "../domain/tutorial";
import {
  getAvailableUpgradeIds,
  getLockedUpgradeIds,
  getMaxedUpgradeIds,
} from "./systems/levelSystem";
import { spawnEnemyAtPosition } from "./systems/spawnSystem";

export const BASIC_TUTORIAL_SEED = 20260720;
export const BASIC_TUTORIAL_HINT_SECONDS = [8, 20] as const;
export const BASIC_TUTORIAL_MOVE_DISTANCE = 64;
export const BASIC_TUTORIAL_NAVIGATION_ZONE = {
  x: 280,
  y: 110,
  radius: 32,
} as const;
export const BASIC_TUTORIAL_UPGRADE_CHOICES = [
  "rapidFire",
  "swiftStep",
  "vitalCore",
] as const;

const TASK_STEPS: TutorialStepId[] = [
  "move",
  "navigate",
  "aimAndKill",
  "collectXp",
  "dodgeProjectile",
  "collectRepair",
  "chooseUpgrade",
  "transferDrill",
];
const TRAINING_PLAYER_START = { x: 480, y: 270 } as const;
const TRAINING_ENEMY_POSITION = { x: 480, y: 100 } as const;
const TRAINING_XP_POSITION = { x: 480, y: 100 } as const;
const TRANSFER_SURVIVAL_SECONDS = 20;
const TRANSFER_REQUIRED_KILLS = 2;
const TRANSFER_REQUIRED_PICKUPS = 1;

type ControllerCheckpoint = {
  // Checkpoints intentionally own World state only. Training steps must not
  // consume RandomStreams because retries do not rewind their generators.
  world: WorldState;
  movementDistance: number;
  dodgePasses: number;
  trackedProjectileId: string | null;
  targetEnemyId: string | null;
  targetPickupId: string | null;
  transferSurvivalSeconds: number;
  transferKills: number;
  transferPickups: number;
  target: TutorialTarget | null;
};

export class TutorialController {
  private stepId: TutorialStepId = "move";
  private stepActiveSeconds = 0;
  private totalActiveSeconds = 0;
  private movementDistance = 0;
  private dodgePasses = 0;
  private trackedProjectileId: string | null = null;
  private targetEnemyId: string | null = null;
  private targetPickupId: string | null = null;
  private target: TutorialTarget | null = null;
  private retryCount = 0;
  private transferSurvivalSeconds = 0;
  private transferKills = 0;
  private transferPickups = 0;
  private checkpoint: ControllerCheckpoint | null = null;
  private pendingEvents: GameEvent[] = [];

  initialize(world: WorldState, config: SimulationConfig): void {
    world.state.status = "playing";
    world.state.hp = Math.max(1, Math.floor(config.player.maxHp * 0.6));
    world.state.damageCooldown = 0;
    world.state.lastAim = { x: 1, y: 0 };
    world.player.position = { ...TRAINING_PLAYER_START };
    clearTransientWorld(world);
    this.enterStep("move", world, config, this.pendingEvents);
  }

  update(
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
    frameBefore: { elapsed: number; playerPosition: Vec2 },
  ): GameEvent[] {
    const added = this.drainPendingEvents();
    const activeDelta =
      world.state.status === "playing"
        ? Math.max(0, world.state.elapsed - frameBefore.elapsed)
        : 0;
    this.stepActiveSeconds += activeDelta;
    this.totalActiveSeconds += activeDelta;
    this.syncTargetPosition(world);

    if (events.some((event) => event.type === "game.over")) {
      this.retryFromCheckpoint(world, events, added);
      return added;
    }

    switch (this.stepId) {
      case "move":
        this.movementDistance += Math.hypot(
          world.player.position.x - frameBefore.playerPosition.x,
          world.player.position.y - frameBefore.playerPosition.y,
        );
        if (this.movementDistance >= BASIC_TUTORIAL_MOVE_DISTANCE) {
          this.advanceTo("navigate", world, config, added);
        }
        break;
      case "navigate":
        if (isInsideZone(world.player.position, BASIC_TUTORIAL_NAVIGATION_ZONE)) {
          this.advanceTo("aimAndKill", world, config, added);
        }
        break;
      case "aimAndKill":
        if (
          this.targetEnemyId &&
          events.some(
            (event) =>
              event.type === "enemy.killed" && event.enemyId === this.targetEnemyId,
          )
        ) {
          const spawnedXp = events.find(
            (event) =>
              event.type === "pickup.spawned" && event.pickupKind === "xp",
          );
          this.targetPickupId =
            spawnedXp?.type === "pickup.spawned" ? spawnedXp.pickupId : null;
          this.advanceTo("collectXp", world, config, added);
        }
        break;
      case "collectXp":
        if (
          this.targetPickupId &&
          events.some(
            (event) =>
              event.type === "pickup.collected" &&
              event.pickupKind === "xp" &&
              event.pickupId === this.targetPickupId,
          )
        ) {
          this.advanceTo("dodgeProjectile", world, config, added);
        }
        break;
      case "dodgeProjectile":
        if (this.didTrackedProjectileHit(events)) {
          this.retryFromCheckpoint(world, events, added);
          break;
        }
        if (
          this.trackedProjectileId &&
          !world.enemyProjectiles.some(
            (projectile) => projectile.id === this.trackedProjectileId,
          )
        ) {
          this.dodgePasses += 1;
          if (this.dodgePasses >= 2) {
            this.advanceTo("collectRepair", world, config, added);
          } else {
            this.trackedProjectileId = spawnTrainingProjectile(world, config);
          }
        }
        break;
      case "collectRepair":
        if (
          this.targetPickupId &&
          events.some(
            (event) =>
              event.type === "pickup.collected" &&
              event.pickupKind === "heal" &&
              event.pickupId === this.targetPickupId &&
              event.hpRecovered > 0,
          )
        ) {
          this.advanceTo("chooseUpgrade", world, config, added);
          break;
        }
        if (
          this.targetPickupId &&
          events.some(
            (event) =>
              event.type === "pickup.expired" &&
              event.pickupId === this.targetPickupId,
          )
        ) {
          this.spawnRepairTarget(world, config, added);
          this.captureCheckpoint(world);
        }
        break;
      case "chooseUpgrade":
        if (events.some((event) => event.type === "upgrade.selected")) {
          this.advanceTo("transferDrill", world, config, added);
        }
        break;
      case "transferDrill":
        this.transferSurvivalSeconds += activeDelta;
        this.transferKills += events.filter(
          (event) => event.type === "enemy.killed",
        ).length;
        this.transferPickups += events.filter(
          (event) => event.type === "pickup.collected",
        ).length;
        if (
          this.transferSurvivalSeconds >= TRANSFER_SURVIVAL_SECONDS &&
          this.transferKills >= TRANSFER_REQUIRED_KILLS &&
          this.transferPickups >= TRANSFER_REQUIRED_PICKUPS
        ) {
          this.advanceTo("complete", world, config, added);
        }
        break;
      case "complete":
        break;
    }

    return added;
  }

  getSnapshot(): TutorialSnapshot {
    const index = TASK_STEPS.indexOf(this.stepId);
    return {
      stepId: this.stepId,
      stepNumber: this.stepId === "complete" ? TASK_STEPS.length : index + 1,
      stepCount: TASK_STEPS.length,
      stepActiveSeconds: this.stepActiveSeconds,
      totalActiveSeconds: this.totalActiveSeconds,
      hintLevel: getHintLevel(this.stepActiveSeconds),
      progress: this.getProgress(),
      target: this.target ? structuredClone(this.target) : null,
      retryCount: this.retryCount,
      transfer: {
        survivalSeconds: this.transferSurvivalSeconds,
        kills: this.transferKills,
        pickups: this.transferPickups,
      },
    };
  }

  private advanceTo(
    nextStep: TutorialStepId,
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
  ): void {
    events.push({
      type: "tutorial.step.completed",
      stepId: this.stepId,
      elapsed: this.totalActiveSeconds,
    });
    this.enterStep(nextStep, world, config, events);
  }

  private enterStep(
    stepId: TutorialStepId,
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
  ): void {
    const previousTargetPickupId = this.targetPickupId;
    this.stepId = stepId;
    this.stepActiveSeconds = 0;
    this.target = null;
    this.targetEnemyId = null;
    this.targetPickupId = null;
    this.trackedProjectileId = null;

    if (stepId === "move") {
      this.movementDistance = 0;
    } else if (stepId === "navigate") {
      this.target = {
        kind: "zone",
        id: null,
        position: {
          x: BASIC_TUTORIAL_NAVIGATION_ZONE.x,
          y: BASIC_TUTORIAL_NAVIGATION_ZONE.y,
        },
        radius: BASIC_TUTORIAL_NAVIGATION_ZONE.radius,
      };
    } else if (stepId === "aimAndKill") {
      clearTransientWorld(world);
      const enemy = spawnEnemyAtPosition(
        world,
        "chaser",
        { spawnInterval: 60, speedMultiplier: 1, maxEnemies: 1 },
        TRAINING_ENEMY_POSITION,
        config,
      );
      this.targetEnemyId = enemy.id;
      this.target = {
        kind: "enemy",
        id: enemy.id,
        position: { ...enemy.position },
        radius: enemy.radius + 12,
      };
      events.push({
        type: "enemy.spawned",
        enemyId: enemy.id,
        enemyType: enemy.typeId,
        position: { ...enemy.position },
      });
    } else if (stepId === "collectXp") {
      const pickup =
        world.pickups.find(
          (item) => item.id === previousTargetPickupId && item.kind === "xp",
        ) ?? spawnTrainingXp(world, config, TRAINING_XP_POSITION);
      pickup.position = { ...TRAINING_XP_POSITION };
      this.targetPickupId = pickup.id;
      this.target = {
        kind: "pickup",
        id: pickup.id,
        position: { ...pickup.position },
        radius: pickup.radius + 12,
      };
      if (!events.some((event) => event.type === "pickup.spawned" && event.pickupId === pickup.id)) {
        events.push({
          type: "pickup.spawned",
          pickupId: pickup.id,
          pickupKind: "xp",
          position: { ...pickup.position },
          xpValue: pickup.xpValue,
          healValue: 0,
          lifetime: null,
        });
      }
    } else if (stepId === "dodgeProjectile") {
      clearTransientWorld(world);
      world.player.position = { ...TRAINING_PLAYER_START };
      world.state.hp = Math.max(1, Math.floor(config.player.maxHp * 0.6));
      world.state.damageCooldown = 0;
      this.dodgePasses = 0;
      this.trackedProjectileId = spawnTrainingProjectile(world, config);
    } else if (stepId === "collectRepair") {
      clearTransientWorld(world);
      world.state.hp = Math.min(
        world.state.hp,
        Math.max(1, Math.floor(config.player.maxHp * 0.6)),
      );
      this.spawnRepairTarget(world, config, events);
    } else if (stepId === "chooseUpgrade") {
      world.progression.level = Math.max(2, world.progression.level);
      world.progression.xp = 0;
      world.progression.pendingUpgradeChoices = [
        ...BASIC_TUTORIAL_UPGRADE_CHOICES,
      ];
      world.state.status = "upgradeSelect";
      const availableUpgradeIds = getAvailableUpgradeIds(
        config,
        world.progression.upgradeRanks,
        world.state.weaponType,
      );
      events.push(
        {
          type: "player.level_up",
          level: world.progression.level,
          choices: [...BASIC_TUTORIAL_UPGRADE_CHOICES],
        },
        {
          type: "upgrade.offered",
          level: world.progression.level,
          choices: [...BASIC_TUTORIAL_UPGRADE_CHOICES],
          availableUpgradeIds,
          lockedUpgradeIds: getLockedUpgradeIds(
            config,
            world.progression.upgradeRanks,
            world.state.weaponType,
          ),
          maxedUpgradeIds: getMaxedUpgradeIds(
            config,
            world.progression.upgradeRanks,
            world.state.weaponType,
          ),
        },
      );
    } else if (stepId === "transferDrill") {
      clearTransientWorld(world);
      world.state.status = "playing";
      world.progression.xp = 0;
      world.progression.xpToNext = Number.MAX_SAFE_INTEGER;
      this.transferSurvivalSeconds = 0;
      this.transferKills = 0;
      this.transferPickups = 0;
      spawnTransferEnemy(world, config, "chaser", { x: 100, y: 270 }, events);
      spawnTransferEnemy(world, config, "brute", { x: 860, y: 270 }, events);
      spawnTransferEnemy(world, config, "ranged", { x: 480, y: 70 }, events);
      spawnTransferRepair(world, config, { x: 480, y: 460 }, events);
    } else {
      clearTransientWorld(world);
      world.state.status = "trainingComplete";
      events.push({
        type: "tutorial.completed",
        elapsed: this.totalActiveSeconds,
      });
    }

    events.push({
      type: "tutorial.step.started",
      stepId,
      stepNumber: stepId === "complete" ? TASK_STEPS.length : TASK_STEPS.indexOf(stepId) + 1,
    });
    if (stepId !== "complete") this.captureCheckpoint(world);
  }

  private spawnRepairTarget(
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
  ): void {
    const pickup = spawnTrainingHeal(world, config, TRAINING_PLAYER_START);
    this.targetPickupId = pickup.id;
    this.target = {
      kind: "pickup",
      id: pickup.id,
      position: { ...pickup.position },
      radius: pickup.radius + 12,
    };
    events.push({
      type: "pickup.spawned",
      pickupId: pickup.id,
      pickupKind: "heal",
      position: { ...pickup.position },
      xpValue: 0,
      healValue: pickup.healValue,
      lifetime: pickup.lifetime ?? config.pickup.healLifetime,
    });
  }

  private didTrackedProjectileHit(events: readonly GameEvent[]): boolean {
    return Boolean(
      this.trackedProjectileId &&
        events.some(
          (event) =>
            event.type === "player.damaged" &&
            event.source?.kind === "projectile" &&
            event.source.projectileId === this.trackedProjectileId,
        ),
    );
  }

  private syncTargetPosition(world: WorldState): void {
    if (!this.target?.id) return;
    if (this.target.kind === "enemy") {
      const enemy = world.enemies.find((item) => item.id === this.target!.id);
      if (enemy) this.target.position = { ...enemy.position };
      return;
    }
    if (this.target.kind === "pickup") {
      const pickup = world.pickups.find((item) => item.id === this.target!.id);
      if (pickup) this.target.position = { ...pickup.position };
    }
  }

  private retryFromCheckpoint(
    world: WorldState,
    sourceEvents: GameEvent[],
    added: GameEvent[],
  ): void {
    if (!this.checkpoint) return;
    const damageEvent = sourceEvents.find(
      (event) => event.type === "player.damaged",
    );
    sourceEvents.splice(0, sourceEvents.length);
    if (damageEvent) sourceEvents.push(damageEvent);
    Object.assign(world, structuredClone(this.checkpoint.world));
    this.movementDistance = this.checkpoint.movementDistance;
    this.dodgePasses = this.checkpoint.dodgePasses;
    this.trackedProjectileId = this.checkpoint.trackedProjectileId;
    this.targetEnemyId = this.checkpoint.targetEnemyId;
    this.targetPickupId = this.checkpoint.targetPickupId;
    this.transferSurvivalSeconds = this.checkpoint.transferSurvivalSeconds;
    this.transferKills = this.checkpoint.transferKills;
    this.transferPickups = this.checkpoint.transferPickups;
    this.target = this.checkpoint.target
      ? structuredClone(this.checkpoint.target)
      : null;
    this.stepActiveSeconds = 0;
    this.retryCount += 1;
    added.push({
      type: "tutorial.step.retried",
      stepId: this.stepId,
      retryCount: this.retryCount,
    });
  }

  private captureCheckpoint(world: WorldState): void {
    this.checkpoint = {
      world: structuredClone(world),
      movementDistance: this.movementDistance,
      dodgePasses: this.dodgePasses,
      trackedProjectileId: this.trackedProjectileId,
      targetEnemyId: this.targetEnemyId,
      targetPickupId: this.targetPickupId,
      transferSurvivalSeconds: this.transferSurvivalSeconds,
      transferKills: this.transferKills,
      transferPickups: this.transferPickups,
      target: this.target ? structuredClone(this.target) : null,
    };
  }

  private drainPendingEvents(): GameEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private getProgress(): { current: number; required: number } {
    if (this.stepId === "move") {
      return {
        current: Math.min(this.movementDistance, BASIC_TUTORIAL_MOVE_DISTANCE),
        required: BASIC_TUTORIAL_MOVE_DISTANCE,
      };
    }
    if (this.stepId === "dodgeProjectile") {
      return { current: this.dodgePasses, required: 2 };
    }
    if (this.stepId === "transferDrill") {
      return {
        current:
          Number(this.transferSurvivalSeconds >= TRANSFER_SURVIVAL_SECONDS) +
          Number(this.transferKills >= TRANSFER_REQUIRED_KILLS) +
          Number(this.transferPickups >= TRANSFER_REQUIRED_PICKUPS),
        required: 3,
      };
    }
    return { current: this.stepId === "complete" ? 1 : 0, required: 1 };
  }
}

function clearTransientWorld(world: WorldState): void {
  world.bullets = [];
  world.enemies = [];
  world.enemyProjectiles = [];
  world.pickups = [];
  world.progression.pendingUpgradeChoices = [];
}

function isInsideZone(
  position: Vec2,
  zone: { x: number; y: number; radius: number },
): boolean {
  return Math.hypot(position.x - zone.x, position.y - zone.y) <= zone.radius;
}

function getHintLevel(activeSeconds: number): 0 | 1 | 2 {
  if (activeSeconds >= BASIC_TUTORIAL_HINT_SECONDS[1]) return 2;
  if (activeSeconds >= BASIC_TUTORIAL_HINT_SECONDS[0]) return 1;
  return 0;
}

function spawnTrainingProjectile(
  world: WorldState,
  config: SimulationConfig,
): string {
  const ranged = config.enemies.ranged.ranged!;
  const projectile: EnemyProjectile = {
    id: `enemy-projectile-${world.nextEnemyProjectileId++}`,
    position: { x: 64, y: TRAINING_PLAYER_START.y },
    radius: ranged.projectileRadius,
    velocity: { x: ranged.projectileSpeed, y: 0 },
    lifetime: 4,
    damage: ranged.projectileDamage,
  };
  world.enemyProjectiles.push(projectile);
  return projectile.id;
}

function spawnTrainingXp(
  world: WorldState,
  config: SimulationConfig,
  position: Vec2,
) {
  const pickup = {
    id: `pickup-${world.nextPickupId++}`,
    kind: "xp" as const,
    position: { ...position },
    radius: config.pickup.xpRadius,
    xpValue: 1,
    healValue: 0,
    lifetime: null,
  };
  world.pickups.push(pickup);
  return pickup;
}

function spawnTrainingHeal(
  world: WorldState,
  config: SimulationConfig,
  position: Vec2,
) {
  const pickup = {
    id: `pickup-${world.nextPickupId++}`,
    kind: "heal" as const,
    position: { ...position },
    radius: config.pickup.healRadius,
    xpValue: 0,
    healValue: Math.max(
      config.pickup.healMinimum,
      Math.floor(config.player.maxHp * config.pickup.healRatio),
    ),
    lifetime: config.pickup.healLifetime,
  };
  world.pickups.push(pickup);
  return pickup;
}

function spawnTransferEnemy(
  world: WorldState,
  config: SimulationConfig,
  typeId: "chaser" | "brute" | "ranged",
  position: Vec2,
  events: GameEvent[],
): void {
  const enemy = spawnEnemyAtPosition(
    world,
    typeId,
    { spawnInterval: 60, speedMultiplier: 1, maxEnemies: 3 },
    position,
    config,
  );
  events.push({
    type: "enemy.spawned",
    enemyId: enemy.id,
    enemyType: enemy.typeId,
    position: { ...enemy.position },
  });
}

function spawnTransferRepair(
  world: WorldState,
  config: SimulationConfig,
  position: Vec2,
  events: GameEvent[],
): void {
  const pickup = spawnTrainingHeal(world, config, position);
  events.push({
    type: "pickup.spawned",
    pickupId: pickup.id,
    pickupKind: "heal",
    position: { ...pickup.position },
    xpValue: 0,
    healValue: pickup.healValue,
    lifetime: pickup.lifetime,
  });
}
