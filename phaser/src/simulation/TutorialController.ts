import type {
  EnemyProjectile,
  GameEvent,
  InputSnapshot,
  Pickup,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../domain/types";
import type {
  TutorialSnapshot,
  TutorialPhase,
  TutorialRetryReason,
  TutorialStepId,
  TutorialTarget,
  TutorialUpgradeId,
} from "../domain/tutorial";
import {
  getAvailableUpgradeIds,
  getLockedUpgradeIds,
  getMaxedUpgradeIds,
} from "./systems/levelSystem";
import { spawnEnemyAtPosition } from "./systems/spawnSystem";

export const BASIC_TUTORIAL_SEED = 20260720;
export const BASIC_TUTORIAL_NO_PROGRESS_HINT_SECONDS = [5, 10] as const;
export const BASIC_TUTORIAL_MOVE_LEGS = 2;
export const BASIC_TUTORIAL_MOVE_RIGHT_ZONE = {
  x: 600,
  y: 270,
  radius: 28,
} as const;
export const BASIC_TUTORIAL_MOVE_LEFT_ZONE = {
  x: 360,
  y: 270,
  radius: 28,
} as const;
export const BASIC_TUTORIAL_NAVIGATION_START = {
  x: 160,
  y: 166,
} as const;
export const BASIC_TUTORIAL_NAVIGATION_ZONE = {
  x: 400,
  y: 166,
  radius: 32,
} as const;
export const BASIC_TUTORIAL_NAVIGATION_WAYPOINTS = [
  { x: 190, y: 116 },
  { x: 370, y: 116 },
] as const;
export const BASIC_TUTORIAL_UPGRADE_CHOICES = [
  "rapidFire",
  "swiftStep",
  "vitalCore",
] as const;

const TASK_STEPS: TutorialStepId[] = [
  "move",
  "navigate",
  "contactDamage",
  "aimAndKill",
  "collectXp",
  "chooseUpgrade",
  "dodgeProjectile",
  "collectRepair",
  "transferDrill",
];
const TRAINING_PLAYER_START = { x: 480, y: 270 } as const;
export const BASIC_TUTORIAL_COMBAT_PLAYER_POSITION = {
  x: 200,
  y: 270,
} as const;
export const BASIC_TUTORIAL_CONTACT_ENEMY_POSITION = {
  x: 300,
  y: 270,
} as const;
export const BASIC_TUTORIAL_COMBAT_ENEMY_POSITION = {
  x: 760,
  y: 270,
} as const;
export const BASIC_TUTORIAL_MOVING_ENEMY_POSITION = {
  x: 760,
  y: 370,
} as const;
const TRAINING_XP_POSITION = { x: 480, y: 100 } as const;
export const BASIC_TUTORIAL_REPAIR_PLAYER_POSITION = {
  x: 320,
  y: 270,
} as const;
export const BASIC_TUTORIAL_REPAIR_POSITION = {
  x: 640,
  y: 270,
} as const;
const TRANSFER_REQUIRED_KILLS = 3;
const DODGE_READY_SECONDS = 1;
const RETRY_NOTICE_SECONDS = 1.8;
export const BASIC_TUTORIAL_TRANSFER_REPAIR_POSITION = {
  x: 480,
  y: 420,
} as const;

type ControllerCheckpoint = {
  // Checkpoints intentionally own World state only. Training steps must not
  // consume RandomStreams because retries do not rewind their generators.
  world: WorldState;
  movementLegsCompleted: number;
  aimTargetsDefeated: number;
  dodgePasses: number;
  trackedProjectileId: string | null;
  targetEnemyId: string | null;
  targetPickupId: string | null;
  transferSurvivalSeconds: number;
  transferKills: number;
  transferPickups: number;
  transferSpawnedPickups: number;
  transferEnemiesRemaining: number;
  transferPickupsRemaining: number;
  dodgeReadySecondsRemaining: number;
  target: TutorialTarget | null;
};

export class TutorialController {
  private stepId: TutorialStepId = "move";
  private phase: TutorialPhase = "briefing";
  private stepActiveSeconds = 0;
  private totalActiveSeconds = 0;
  private noProgressSeconds = 0;
  private movementLegsCompleted = 0;
  private aimTargetsDefeated = 0;
  private dodgePasses = 0;
  private trackedProjectileId: string | null = null;
  private targetEnemyId: string | null = null;
  private targetPickupId: string | null = null;
  private carriedPickupId: string | null = null;
  private target: TutorialTarget | null = null;
  private lastCompletedStepId: TutorialStepId | null = null;
  private selectedUpgradeId: TutorialUpgradeId | null = null;
  private retryCount = 0;
  private retryReason: TutorialRetryReason | null = null;
  private retryNoticeSecondsRemaining = 0;
  private dodgeReadySecondsRemaining = 0;
  private transferSurvivalSeconds = 0;
  private transferKills = 0;
  private transferPickups = 0;
  private transferSpawnedPickups = 0;
  private transferEnemiesRemaining = 0;
  private transferPickupsRemaining = 0;
  private checkpoint: ControllerCheckpoint | null = null;
  private pendingEvents: GameEvent[] = [];

  initialize(world: WorldState, config: SimulationConfig): void {
    world.state.hp = getPlayerMaxHp(world, config);
    world.state.damageCooldown = 0;
    world.state.lastAim = { x: 1, y: 0 };
    world.player.position = { ...TRAINING_PLAYER_START };
    clearTransientWorld(world);
    this.enterStep("move", world, config, this.pendingEvents);
  }

  prepareInput(input: InputSnapshot): InputSnapshot {
    if (this.stepId !== "contactDamage" || this.phase !== "active") return input;
    return {
      ...input,
      move: { x: 0, y: 0 },
      aimWorld: null,
      shootHeld: false,
    };
  }

  update(
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
    frameBefore: { elapsed: number; playerPosition: Vec2 },
    input: Partial<
      Pick<
        InputSnapshot,
        "aimWorld" | "move" | "shootHeld" | "tutorialContinuePressed"
      >
    > = {},
  ): GameEvent[] {
    const added = this.drainPendingEvents();

    if (this.phase === "briefing") {
      if (events.some((event) => event.type === "game.resumed")) {
        world.state.status = "trainingBriefing";
      }
      if (
        world.state.status === "trainingBriefing" &&
        input.tutorialContinuePressed
      ) {
        this.activateStep(world, config, added);
      }
      return added;
    }

    if (
      this.stepId === "chooseUpgrade" &&
      events.some((event) => event.type === "game.resumed")
    ) {
      world.state.status = "upgradeSelect";
    }

    const activeDelta =
      this.phase === "active" && world.state.status === "playing"
        ? Math.max(0, world.state.elapsed - frameBefore.elapsed)
        : 0;
    this.stepActiveSeconds += activeDelta;
    this.totalActiveSeconds += activeDelta;
    this.retryNoticeSecondsRemaining = Math.max(
      0,
      this.retryNoticeSecondsRemaining - activeDelta,
    );
    if (this.retryNoticeSecondsRemaining === 0) this.retryReason = null;
    const targetPositionBefore = this.target
      ? { ...this.target.position }
      : null;
    this.syncTargetPosition(world);
    if (activeDelta > 0 && this.isHintEligible()) {
      const previousHintLevel = getHintLevel(this.noProgressSeconds);
      if (
        this.hasMeaningfulProgress(
          world,
          events,
          frameBefore,
          input,
          targetPositionBefore,
        )
      ) {
        this.noProgressSeconds = 0;
      } else {
        this.noProgressSeconds += activeDelta;
      }
      const nextHintLevel = getHintLevel(this.noProgressSeconds);
      if (
        nextHintLevel > previousHintLevel &&
        (nextHintLevel === 1 || nextHintLevel === 2)
      ) {
        added.push({
          type: "tutorial.hint.shown",
          stepId: this.stepId,
          hintLevel: nextHintLevel,
          noProgressSeconds: this.noProgressSeconds,
        });
      }
    }

    if (events.some((event) => event.type === "game.over")) {
      this.retryFromCheckpoint(world, events, added);
      return added;
    }

    switch (this.stepId) {
      case "move":
        if (
          this.movementLegsCompleted === 0 &&
          isInsideZone(world.player.position, BASIC_TUTORIAL_MOVE_RIGHT_ZONE)
        ) {
          this.movementLegsCompleted = 1;
          this.target = createZoneTarget(BASIC_TUTORIAL_MOVE_LEFT_ZONE);
        } else if (
          this.movementLegsCompleted === 1 &&
          isInsideZone(world.player.position, BASIC_TUTORIAL_MOVE_LEFT_ZONE)
        ) {
          this.movementLegsCompleted = BASIC_TUTORIAL_MOVE_LEGS;
          this.advanceTo("navigate", world, config, added);
        }
        break;
      case "navigate":
        if (isInsideZone(world.player.position, BASIC_TUTORIAL_NAVIGATION_ZONE)) {
          this.advanceTo("contactDamage", world, config, added);
        }
        break;
      case "contactDamage":
        if (
          this.targetEnemyId &&
          events.some(
            (event) =>
              event.type === "player.damaged" &&
              event.source?.kind === "contact" &&
              event.source.enemyId === this.targetEnemyId,
          )
        ) {
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
          if (this.aimTargetsDefeated === 0) {
            this.aimTargetsDefeated = 1;
            world.bullets = [];
            const enemy = spawnTutorialEnemy(
              world,
              config,
              BASIC_TUTORIAL_MOVING_ENEMY_POSITION,
              false,
            );
            this.targetEnemyId = enemy.id;
            this.target = createEnemyTarget(enemy);
            added.push({
              type: "enemy.spawned",
              enemyId: enemy.id,
              enemyType: enemy.typeId,
              position: { ...enemy.position },
            });
            break;
          }
          this.aimTargetsDefeated = 2;
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
          this.advanceTo("chooseUpgrade", world, config, added);
        }
        break;
      case "chooseUpgrade": {
        const selected = events.find(
          (event) => event.type === "upgrade.selected",
        );
        if (selected?.type === "upgrade.selected") {
          this.selectedUpgradeId = isTutorialUpgradeId(selected.upgradeId)
            ? selected.upgradeId
            : null;
          this.advanceTo("dodgeProjectile", world, config, added);
        }
        break;
      }
      case "dodgeProjectile":
        if (this.didTrackedProjectileHit(events)) {
          this.retryFromCheckpoint(world, events, added);
          break;
        }
        if (!this.trackedProjectileId) {
          this.dodgeReadySecondsRemaining = Math.max(
            0,
            this.dodgeReadySecondsRemaining - activeDelta,
          );
          if (this.dodgeReadySecondsRemaining === 0) {
            this.trackedProjectileId = spawnTrainingProjectile(world, config);
          }
          break;
        }
        if (
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
          this.advanceTo("transferDrill", world, config, added);
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
      case "transferDrill":
        this.transferSurvivalSeconds += activeDelta;
        this.transferKills += events.filter(
          (event) => event.type === "enemy.killed",
        ).length;
        for (const event of events) {
          if (event.type !== "pickup.spawned") continue;
          this.transferSpawnedPickups += 1;
          const pickup = world.pickups.find((item) => item.id === event.pickupId);
          if (pickup?.kind === "heal") pickup.lifetime = null;
        }
        this.transferPickups += events.filter(
          (event) => event.type === "pickup.collected",
        ).length;
        this.transferEnemiesRemaining = world.enemies.length;
        this.transferPickupsRemaining = Math.max(
          0,
          this.transferSpawnedPickups - this.transferPickups,
        );
        if (
          this.transferKills >= TRANSFER_REQUIRED_KILLS &&
          this.transferEnemiesRemaining === 0 &&
          this.transferPickupsRemaining === 0
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
      phase: this.phase,
      stepNumber: this.stepId === "complete" ? TASK_STEPS.length : index + 1,
      stepCount: TASK_STEPS.length,
      stepActiveSeconds: this.stepActiveSeconds,
      totalActiveSeconds: this.totalActiveSeconds,
      noProgressSeconds: this.noProgressSeconds,
      hintLevel: getHintLevel(this.noProgressSeconds),
      progress: this.getProgress(),
      target: this.target ? structuredClone(this.target) : null,
      lastCompletedStepId: this.lastCompletedStepId,
      selectedUpgradeId: this.selectedUpgradeId,
      retryCount: this.retryCount,
      retryReason: this.retryReason,
      retryNoticeSecondsRemaining: this.retryNoticeSecondsRemaining,
      readySecondsRemaining: this.dodgeReadySecondsRemaining,
      transfer: {
        survivalSeconds: this.transferSurvivalSeconds,
        kills: this.transferKills,
        pickups: this.transferPickups,
        spawnedPickups: this.transferSpawnedPickups,
        requiredKills: TRANSFER_REQUIRED_KILLS,
        enemiesRemaining: this.transferEnemiesRemaining,
        pickupsRemaining: this.transferPickupsRemaining,
        repairPosition: { ...BASIC_TUTORIAL_TRANSFER_REPAIR_POSITION },
      },
    };
  }

  private advanceTo(
    nextStep: TutorialStepId,
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
  ): void {
    this.lastCompletedStepId = this.stepId;
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
    this.phase = stepId === "complete" ? "complete" : "briefing";
    this.stepActiveSeconds = 0;
    this.noProgressSeconds = 0;
    this.target = null;
    this.targetEnemyId = null;
    this.targetPickupId = null;
    this.carriedPickupId =
      stepId === "collectXp" ? previousTargetPickupId : null;
    this.trackedProjectileId = null;
    this.retryCount = 0;
    this.retryReason = null;
    this.retryNoticeSecondsRemaining = 0;
    this.dodgeReadySecondsRemaining = 0;

    if (stepId === "complete") {
      clearTransientWorld(world);
      world.state.status = "trainingComplete";
      events.push({
        type: "tutorial.completed",
        elapsed: this.totalActiveSeconds,
      });
    } else {
      world.state.status = "trainingBriefing";
      this.prepareBriefingWorld(stepId, world, config);
    }

    events.push({
      type: "tutorial.step.started",
      stepId,
      stepNumber:
        stepId === "complete" ? TASK_STEPS.length : TASK_STEPS.indexOf(stepId) + 1,
    });
  }

  private activateStep(
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
  ): void {
    this.phase = "active";
    this.stepActiveSeconds = 0;
    this.noProgressSeconds = 0;
    world.state.status = "playing";

    if (this.stepId === "move") {
      clearTransientWorld(world);
      world.player.position = { ...TRAINING_PLAYER_START };
      this.movementLegsCompleted = 0;
      this.target = createZoneTarget(BASIC_TUTORIAL_MOVE_RIGHT_ZONE);
    } else if (this.stepId === "navigate") {
      world.player.position = { ...BASIC_TUTORIAL_NAVIGATION_START };
      this.target = {
        kind: "zone",
        id: null,
        position: {
          x: BASIC_TUTORIAL_NAVIGATION_ZONE.x,
          y: BASIC_TUTORIAL_NAVIGATION_ZONE.y,
        },
        radius: BASIC_TUTORIAL_NAVIGATION_ZONE.radius,
        guidePath: BASIC_TUTORIAL_NAVIGATION_WAYPOINTS.map((point) => ({
          ...point,
        })),
      };
    } else if (this.stepId === "contactDamage") {
      clearTransientWorld(world);
      world.player.position = { ...BASIC_TUTORIAL_COMBAT_PLAYER_POSITION };
      world.state.damageCooldown = 0;
      const enemy = spawnTutorialEnemy(
        world,
        config,
        BASIC_TUTORIAL_CONTACT_ENEMY_POSITION,
        false,
      );
      this.targetEnemyId = enemy.id;
      this.target = createEnemyTarget(enemy);
      events.push({
        type: "enemy.spawned",
        enemyId: enemy.id,
        enemyType: enemy.typeId,
        position: { ...enemy.position },
      });
    } else if (this.stepId === "aimAndKill") {
      clearTransientWorld(world);
      world.player.position = { ...BASIC_TUTORIAL_COMBAT_PLAYER_POSITION };
      world.state.damageCooldown = 0;
      world.state.hp = getPlayerMaxHp(world, config);
      this.aimTargetsDefeated = 0;
      const enemy = spawnTutorialEnemy(
        world,
        config,
        BASIC_TUTORIAL_COMBAT_ENEMY_POSITION,
        true,
      );
      this.targetEnemyId = enemy.id;
      this.target = createEnemyTarget(enemy);
      events.push({
        type: "enemy.spawned",
        enemyId: enemy.id,
        enemyType: enemy.typeId,
        position: { ...enemy.position },
      });
    } else if (this.stepId === "collectXp") {
      const existingPickup = world.pickups.find(
        (item) => item.id === this.carriedPickupId && item.kind === "xp",
      );
      const pickup =
        existingPickup ?? spawnTrainingXp(world, config, TRAINING_XP_POSITION);
      pickup.position = { ...TRAINING_XP_POSITION };
      this.targetPickupId = pickup.id;
      this.target = {
        kind: "pickup",
        id: pickup.id,
        position: { ...pickup.position },
        radius: pickup.radius + 12,
      };
      if (!existingPickup) {
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
    } else if (this.stepId === "dodgeProjectile") {
      clearTransientWorld(world);
      world.player.position = { ...TRAINING_PLAYER_START };
      world.state.hp = getPlayerMaxHp(world, config);
      world.state.damageCooldown = 0;
      this.dodgePasses = 0;
      this.dodgeReadySecondsRemaining = DODGE_READY_SECONDS;
      this.trackedProjectileId = null;
    } else if (this.stepId === "collectRepair") {
      clearTransientWorld(world);
      world.player.position = { ...BASIC_TUTORIAL_REPAIR_PLAYER_POSITION };
      world.state.hp = Math.max(
        1,
        Math.floor(getPlayerMaxHp(world, config) * 0.6),
      );
      this.spawnRepairTarget(world, config, events);
    } else if (this.stepId === "chooseUpgrade") {
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
    } else if (this.stepId === "transferDrill") {
      clearTransientWorld(world);
      world.state.status = "playing";
      world.progression.xp = 0;
      world.progression.xpToNext = Number.MAX_SAFE_INTEGER;
      world.player.position = { ...TRAINING_PLAYER_START };
      this.transferSurvivalSeconds = 0;
      this.transferKills = 0;
      this.transferPickups = 0;
      this.transferSpawnedPickups = 0;
      this.transferEnemiesRemaining = 0;
      this.transferPickupsRemaining = 0;
      spawnTransferEnemy(world, config, "chaser", { x: 100, y: 270 }, events);
      spawnTransferEnemy(world, config, "brute", { x: 860, y: 270 }, events);
      spawnTransferEnemy(world, config, "ranged", { x: 480, y: 70 }, events);
      spawnTransferRepair(
        world,
        config,
        BASIC_TUTORIAL_TRANSFER_REPAIR_POSITION,
        events,
      );
      this.transferSpawnedPickups = world.pickups.length;
      this.transferEnemiesRemaining = world.enemies.length;
      this.transferPickupsRemaining = this.transferSpawnedPickups;
    }

    events.push({
      type: "tutorial.step.activated",
      stepId: this.stepId,
      stepNumber: TASK_STEPS.indexOf(this.stepId) + 1,
    });
    this.captureCheckpoint(world);
  }

  private prepareBriefingWorld(
    stepId: TutorialStepId,
    world: WorldState,
    config: SimulationConfig,
  ): void {
    if (
      stepId === "navigate" ||
      stepId === "contactDamage" ||
      stepId === "aimAndKill" ||
      stepId === "dodgeProjectile" ||
      stepId === "collectRepair" ||
      stepId === "transferDrill"
    ) {
      clearTransientWorld(world);
    }
    if (stepId === "navigate") {
      world.player.position = { ...BASIC_TUTORIAL_NAVIGATION_START };
    }
    if (stepId === "contactDamage") {
      world.player.position = { ...BASIC_TUTORIAL_COMBAT_PLAYER_POSITION };
      world.state.hp = getPlayerMaxHp(world, config);
      world.state.damageCooldown = 0;
    }
    if (stepId === "aimAndKill") {
      world.player.position = { ...BASIC_TUTORIAL_COMBAT_PLAYER_POSITION };
      world.state.damageCooldown = 0;
    }
    if (stepId === "dodgeProjectile") {
      world.player.position = { ...TRAINING_PLAYER_START };
      world.state.hp = getPlayerMaxHp(world, config);
      world.state.damageCooldown = 0;
    }
    if (stepId === "collectRepair") {
      world.player.position = { ...BASIC_TUTORIAL_REPAIR_PLAYER_POSITION };
      world.state.hp = Math.max(
        1,
        Math.floor(getPlayerMaxHp(world, config) * 0.6),
      );
    }
    if (stepId === "chooseUpgrade") {
      world.progression.xp = world.progression.xpToNext;
    }
  }

  private spawnRepairTarget(
    world: WorldState,
    config: SimulationConfig,
    events: GameEvent[],
  ): void {
    const pickup = spawnTrainingHeal(
      world,
      config,
      BASIC_TUTORIAL_REPAIR_POSITION,
    );
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

  private isHintEligible(): boolean {
    return (
      this.stepId === "move" ||
      this.stepId === "navigate" ||
      this.stepId === "aimAndKill" ||
      this.stepId === "collectXp" ||
      this.stepId === "dodgeProjectile" ||
      this.stepId === "collectRepair"
    );
  }

  private hasMeaningfulProgress(
    world: WorldState,
    events: readonly GameEvent[],
    frameBefore: { playerPosition: Vec2 },
    input: Partial<Pick<InputSnapshot, "aimWorld" | "move" | "shootHeld">>,
    targetPositionBefore: Vec2 | null,
  ): boolean {
    const playerDistance = Math.hypot(
      world.player.position.x - frameBefore.playerPosition.x,
      world.player.position.y - frameBefore.playerPosition.y,
    );

    if (
      this.stepId === "move" ||
      this.stepId === "navigate" ||
      this.stepId === "dodgeProjectile"
    ) {
      return playerDistance >= 0.5 || this.didDodgeProjectilePass(world, events);
    }

    if (this.stepId === "aimAndKill") {
      return (
        input.aimWorld != null ||
        events.some(
          (event) =>
            (event.type === "enemy.hit" || event.type === "enemy.killed") &&
            event.enemyId === this.targetEnemyId,
        )
      );
    }

    if (
      (this.stepId === "collectXp" || this.stepId === "collectRepair") &&
      this.target &&
      targetPositionBefore
    ) {
      const beforeDistance = Math.hypot(
        targetPositionBefore.x - frameBefore.playerPosition.x,
        targetPositionBefore.y - frameBefore.playerPosition.y,
      );
      const currentDistance = Math.hypot(
        this.target.position.x - world.player.position.x,
        this.target.position.y - world.player.position.y,
      );
      return currentDistance <= beforeDistance - 0.5;
    }

    return false;
  }

  private didDodgeProjectilePass(
    world: WorldState,
    events: readonly GameEvent[],
  ): boolean {
    return Boolean(
      this.stepId === "dodgeProjectile" &&
        this.trackedProjectileId &&
        !this.didTrackedProjectileHit(events) &&
        !world.enemyProjectiles.some(
          (projectile) => projectile.id === this.trackedProjectileId,
        ),
    );
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
    this.movementLegsCompleted = this.checkpoint.movementLegsCompleted;
    this.aimTargetsDefeated = this.checkpoint.aimTargetsDefeated;
    this.dodgePasses = this.checkpoint.dodgePasses;
    this.trackedProjectileId = this.checkpoint.trackedProjectileId;
    this.targetEnemyId = this.checkpoint.targetEnemyId;
    this.targetPickupId = this.checkpoint.targetPickupId;
    this.transferSurvivalSeconds = this.checkpoint.transferSurvivalSeconds;
    this.transferKills = this.checkpoint.transferKills;
    this.transferPickups = this.checkpoint.transferPickups;
    this.transferSpawnedPickups = this.checkpoint.transferSpawnedPickups;
    this.transferEnemiesRemaining = this.checkpoint.transferEnemiesRemaining;
    this.transferPickupsRemaining = this.checkpoint.transferPickupsRemaining;
    this.dodgeReadySecondsRemaining =
      this.checkpoint.dodgeReadySecondsRemaining;
    this.target = this.checkpoint.target
      ? structuredClone(this.checkpoint.target)
      : null;
    this.retryCount += 1;
    this.retryReason = getRetryReason(damageEvent);
    this.retryNoticeSecondsRemaining = RETRY_NOTICE_SECONDS;
    added.push({
      type: "tutorial.step.retried",
      stepId: this.stepId,
      retryCount: this.retryCount,
      reason: this.retryReason,
    });
  }

  private captureCheckpoint(world: WorldState): void {
    this.checkpoint = {
      world: structuredClone(world),
      movementLegsCompleted: this.movementLegsCompleted,
      aimTargetsDefeated: this.aimTargetsDefeated,
      dodgePasses: this.dodgePasses,
      trackedProjectileId: this.trackedProjectileId,
      targetEnemyId: this.targetEnemyId,
      targetPickupId: this.targetPickupId,
      transferSurvivalSeconds: this.transferSurvivalSeconds,
      transferKills: this.transferKills,
      transferPickups: this.transferPickups,
      transferSpawnedPickups: this.transferSpawnedPickups,
      transferEnemiesRemaining: this.transferEnemiesRemaining,
      transferPickupsRemaining: this.transferPickupsRemaining,
      dodgeReadySecondsRemaining: this.dodgeReadySecondsRemaining,
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
        current: this.movementLegsCompleted,
        required: BASIC_TUTORIAL_MOVE_LEGS,
      };
    }
    if (this.stepId === "aimAndKill") {
      return {
        current: this.aimTargetsDefeated,
        required: 2,
      };
    }
    if (this.stepId === "dodgeProjectile") {
      return { current: this.dodgePasses, required: 2 };
    }
    if (this.stepId === "transferDrill") {
      return {
        current:
          Number(
            this.transferKills >= TRANSFER_REQUIRED_KILLS &&
              this.transferEnemiesRemaining === 0,
          ) + Number(this.transferPickupsRemaining === 0),
        required: 2,
      };
    }
    return { current: this.stepId === "complete" ? 1 : 0, required: 1 };
  }
}

function getPlayerMaxHp(
  world: WorldState,
  config: SimulationConfig,
): number {
  return config.player.maxHp + world.runtime.maxHpBonus;
}

function getRetryReason(
  damageEvent: GameEvent | undefined,
): TutorialRetryReason {
  return damageEvent?.type === "player.damaged" &&
    damageEvent.source?.kind === "projectile"
    ? "enemyProjectile"
    : "damage";
}

function isTutorialUpgradeId(value: string): value is TutorialUpgradeId {
  return BASIC_TUTORIAL_UPGRADE_CHOICES.some((choice) => choice === value);
}

function clearTransientWorld(world: WorldState): void {
  world.bullets = [];
  world.enemies = [];
  world.enemyProjectiles = [];
  world.pickups = [];
  world.progression.pendingUpgradeChoices = [];
}

function createZoneTarget(
  zone: { x: number; y: number; radius: number },
): TutorialTarget {
  return {
    kind: "zone",
    id: null,
    position: { x: zone.x, y: zone.y },
    radius: zone.radius,
  };
}

function createEnemyTarget(
  enemy: ReturnType<typeof spawnEnemyAtPosition>,
): TutorialTarget {
  return {
    kind: "enemy",
    id: enemy.id,
    position: { ...enemy.position },
    radius: enemy.radius + 12,
  };
}

function spawnTutorialEnemy(
  world: WorldState,
  config: SimulationConfig,
  position: Vec2,
  stationary: boolean,
) {
  const enemy = spawnEnemyAtPosition(
    world,
    "chaser",
    { spawnInterval: 60, speedMultiplier: 1, maxEnemies: 1 },
    position,
    config,
  );
  enemy.enteredArena = true;
  if (stationary) {
    enemy.speed = 0;
    enemy.xpValue = 0;
  }
  return enemy;
}

function isInsideZone(
  position: Vec2,
  zone: { x: number; y: number; radius: number },
): boolean {
  return Math.hypot(position.x - zone.x, position.y - zone.y) <= zone.radius;
}

function getHintLevel(noProgressSeconds: number): 0 | 1 | 2 {
  if (noProgressSeconds >= BASIC_TUTORIAL_NO_PROGRESS_HINT_SECONDS[1]) return 2;
  if (noProgressSeconds >= BASIC_TUTORIAL_NO_PROGRESS_HINT_SECONDS[0]) return 1;
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
): Pickup {
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
  pickup.lifetime = null;
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
