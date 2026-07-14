import type {
  InputSnapshot,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../domain/types";
import {
  ENEMY_EVADE_DISTANCE,
  getEnemyAvoidanceDirection,
  getEngagementMove,
  getIdleOrbitMove,
  getProjectileThreats,
  navigateInDirection,
  navigateTo,
  selectProjectileDodgeMove,
} from "./autoPilotMovement";
import {
  canSafelyCollectPickup,
  findFiringPosition,
  findNearestEnemy,
  selectAimTarget,
  selectPickupTarget,
} from "./autoPilotTargeting";

export const AUTO_PILOT_MODIFIER_ID = "auto-pilot:tactical-observer-v1";

export type AutoPilotMode =
  | "contract"
  | "upgrade"
  | "projectileDodge"
  | "enemyEvade"
  | "healCollect"
  | "xpCollect"
  | "reposition"
  | "engage"
  | "patrol";

export type AutoPilotDecision = {
  input: InputSnapshot;
  mode: AutoPilotMode;
  targetId: string | null;
};

const BASE_INPUT: InputSnapshot = {
  move: { x: 0, y: 0 },
  aimWorld: null,
  startPressed: false,
  shootHeld: false,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
};

const UPGRADE_PRIORITY = [
  "pulseRicochet",
  "spreadSweep",
  "pulseFocus",
  "splitShot",
  "rapidFire",
  "piercingRounds",
  "swiftStep",
  "overdriveRounds",
  "vitalCore",
] as const;

export function createAutoPilotInput(
  world: WorldState,
  config: SimulationConfig,
): InputSnapshot {
  return createAutoPilotDecision(world, config).input;
}

export function createAutoPilotDecision(
  world: WorldState,
  config: SimulationConfig,
): AutoPilotDecision {
  if (world.state.status === "contractSelect") {
    return {
      input: { ...BASE_INPUT, contractChoicePressed: 0 },
      mode: "contract",
      targetId: null,
    };
  }
  if (world.state.status === "upgradeSelect") {
    const upgradeIndex = chooseUpgradeIndex(world);
    return {
      input: { ...BASE_INPUT, upgradeChoicePressed: upgradeIndex },
      mode: "upgrade",
      targetId:
        upgradeIndex === null
          ? null
          : world.progression.pendingUpgradeChoices[upgradeIndex] ?? null,
    };
  }
  if (world.state.status !== "playing") {
    return { input: { ...BASE_INPUT }, mode: "patrol", targetId: null };
  }

  const enemyTarget = selectAimTarget(world, config);
  const aimWorld = enemyTarget
    ? { ...enemyTarget.enemy.position }
    : { x: world.player.position.x + 100, y: world.player.position.y };
  const threats = getProjectileThreats(world, config);
  if (threats.length > 0) {
    return createCombatDecision(
      "projectileDodge",
      selectProjectileDodgeMove(world, threats, config),
      aimWorld,
      enemyTarget?.enemy.id ?? threats[0]!.projectile.id,
    );
  }

  const nearestEnemy = findNearestEnemy(world.player.position, world.enemies);
  if (nearestEnemy && nearestEnemy.distance < ENEMY_EVADE_DISTANCE) {
    const desired = getEnemyAvoidanceDirection(
      world,
      ENEMY_EVADE_DISTANCE + 70,
      config,
    );
    return createCombatDecision(
      "enemyEvade",
      navigateInDirection(world, desired, config, 180),
      aimWorld,
      nearestEnemy.enemy.id,
    );
  }

  const pickupTarget = selectPickupTarget(world, config);
  if (pickupTarget && canSafelyCollectPickup(world, pickupTarget, nearestEnemy, config)) {
    return createCombatDecision(
      pickupTarget.pickup.kind === "heal" ? "healCollect" : "xpCollect",
      navigateTo(world, pickupTarget.pickup.position, config),
      aimWorld,
      pickupTarget.pickup.id,
    );
  }

  if (enemyTarget) {
    if (!enemyTarget.visible) {
      const firingPosition = findFiringPosition(world, enemyTarget.enemy, config);
      return createCombatDecision(
        "reposition",
        navigateTo(world, firingPosition ?? enemyTarget.enemy.position, config),
        aimWorld,
        enemyTarget.enemy.id,
      );
    }

    return createCombatDecision(
      "engage",
      getEngagementMove(world, enemyTarget, config),
      aimWorld,
      enemyTarget.enemy.id,
    );
  }

  return createCombatDecision(
    "patrol",
    navigateInDirection(world, getIdleOrbitMove(world, config), config, 150),
    aimWorld,
    null,
  );
}

function createCombatDecision(
  mode: AutoPilotMode,
  move: Vec2,
  aimWorld: Vec2,
  targetId: string | null,
): AutoPilotDecision {
  return {
    mode,
    targetId,
    input: {
      ...BASE_INPUT,
      move,
      aimWorld,
      shootHeld: true,
    },
  };
}

function chooseUpgradeIndex(world: WorldState): number | null {
  let bestIndex: number | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const upgradeId of UPGRADE_PRIORITY) {
    const index = world.progression.pendingUpgradeChoices.indexOf(upgradeId);
    if (index < 0) continue;
    const rank = world.progression.upgradeRanks[upgradeId];
    if (rank < bestRank) {
      bestIndex = index;
      bestRank = rank;
    }
  }
  return bestIndex ?? (world.progression.pendingUpgradeChoices.length > 0 ? 0 : null);
}
