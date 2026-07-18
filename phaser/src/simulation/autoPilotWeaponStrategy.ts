import { FINAL_COMMAND_SHIP_DEFINITION } from "../content/bossCatalog";
import type { Enemy, Vec2, WeaponTypeId } from "../domain/types";
import type {
  AutoPilotEnemyTarget,
  AutoPilotFrame,
  AutoPilotIntentMode,
  AutoPilotPosture,
} from "./autoPilotContracts";
import { dot, lengthSquared } from "./autoPilotMath";
import { hasClearNavigationPath } from "./navigationField";

export type AutoPilotWeaponStrategy = {
  preferredRange: number;
  openSpaceWeight: number;
  lineOfSightReward: number;
  lineOfSightPenalty: number;
  healPriorityHpRatio: number;
  criticalHpRatio: number;
  projectileRiskMultiplier: number;
  enemyRiskMultiplier: number;
  rangedExposureMultiplier: number;
  targetScoreAdjustment(
    frame: AutoPilotFrame,
    target: AutoPilotEnemyTarget,
  ): number;
};

const CEILING_WEAPON_STRATEGIES: Record<WeaponTypeId, AutoPilotWeaponStrategy> = {
  pulse: {
    preferredRange: 225,
    openSpaceWeight: 2.15,
    lineOfSightReward: 175,
    lineOfSightPenalty: 270,
    healPriorityHpRatio: 0.94,
    criticalHpRatio: 0.48,
    projectileRiskMultiplier: 2,
    enemyRiskMultiplier: 1.2,
    rangedExposureMultiplier: 2,
    targetScoreAdjustment: getPulseTargetScoreAdjustment,
  },
  spread: {
    preferredRange: 235,
    openSpaceWeight: 1.45,
    lineOfSightReward: 72,
    lineOfSightPenalty: 145,
    healPriorityHpRatio: 0.75,
    criticalHpRatio: 0.45,
    projectileRiskMultiplier: 1,
    enemyRiskMultiplier: 1,
    rangedExposureMultiplier: 1,
    targetScoreAdjustment: () => 0,
  },
  pierce: {
    preferredRange: 315,
    openSpaceWeight: 1.85,
    lineOfSightReward: 145,
    lineOfSightPenalty: 230,
    healPriorityHpRatio: 0.8,
    criticalHpRatio: 0.47,
    projectileRiskMultiplier: 1.2,
    enemyRiskMultiplier: 1.05,
    rangedExposureMultiplier: 1.8,
    targetScoreAdjustment: (frame, target) =>
      getLineScoreAdjustment(frame, target.enemy, "pierce"),
  },
};

const FAIR_SURVIVAL_STRATEGY = {
  openSpaceWeight: 1.75,
  healPriorityHpRatio: 0.82,
  criticalHpRatio: 0.47,
  projectileRiskMultiplier: 1.2,
  enemyRiskMultiplier: 1.05,
  rangedExposureMultiplier: 1.35,
} as const;

const FAIR_WEAPON_STRATEGIES: Record<WeaponTypeId, AutoPilotWeaponStrategy> = {
  pulse: {
    ...CEILING_WEAPON_STRATEGIES.pulse,
    ...FAIR_SURVIVAL_STRATEGY,
  },
  spread: {
    ...CEILING_WEAPON_STRATEGIES.spread,
    ...FAIR_SURVIVAL_STRATEGY,
  },
  pierce: {
    ...CEILING_WEAPON_STRATEGIES.pierce,
    ...FAIR_SURVIVAL_STRATEGY,
  },
};

export function getAutoPilotWeaponStrategy(
  frame: AutoPilotFrame,
): AutoPilotWeaponStrategy {
  const strategies = frame.profile === "fair"
    ? FAIR_WEAPON_STRATEGIES
    : CEILING_WEAPON_STRATEGIES;
  return strategies[frame.world.state.weaponType];
}

export function getAutoPilotPreferredRange(
  frame: AutoPilotFrame,
  target: Enemy,
): number {
  const base = getAutoPilotWeaponStrategy(frame).preferredRange;
  const boss = frame.world.expedition?.boss;
  if (!target.boss || !boss || boss.status !== "active") return base;
  const pulseRadius = FINAL_COMMAND_SHIP_DEFINITION.commandPulse.radius[boss.phase - 1];
  return Math.max(base, pulseRadius + 70);
}

export function getAutoPilotOpenSpaceWeight(
  frame: AutoPilotFrame,
  mode: AutoPilotIntentMode,
  posture: AutoPilotPosture,
): number {
  const base = getAutoPilotWeaponStrategy(frame).openSpaceWeight;
  if (posture === "defensive") return base + 1.1;
  if (mode === "survive") return base + 1.1;
  if (mode === "healCollect") return base + 0.65;
  return base;
}

export function getAutoPilotFiringLaneReward(
  frame: AutoPilotFrame,
  origin: Vec2,
  target: Enemy,
): number {
  const weaponType = frame.world.state.weaponType;
  if (weaponType === "spread") return 0;
  const lane = analyzeFiringLane(frame, origin, target, weaponType);
  if (lane.targetIndex < 0) return 0;
  if (lane.targetIndex >= lane.hitCapacity) return -180;
  const additionalHits = Math.max(0, lane.reachableHits - 1);
  const multiplier = weaponType === "pulse" ? 125 : 95;
  return additionalHits * multiplier - lane.targetIndex * 35;
}

export function getAutoPilotReachableLaneHits(
  frame: AutoPilotFrame,
  origin: Vec2,
  target: Enemy,
): number {
  const weaponType = frame.world.state.weaponType;
  if (weaponType === "spread") return 0;
  const lane = analyzeFiringLane(frame, origin, target, weaponType);
  return lane.targetIndex >= 0 && lane.targetIndex < lane.hitCapacity
    ? lane.reachableHits
    : 0;
}

function getPulseTargetScoreAdjustment(
  frame: AutoPilotFrame,
  target: AutoPilotEnemyTarget,
): number {
  const enemy = target.enemy;
  const focusActive = (enemy.pulseFocusExpiresAt ?? 0) >= frame.world.state.elapsed;
  const focusPriority = focusActive ? -(enemy.pulseFocusStacks ?? 0) * 255 : 0;
  const retainedPriority = enemy.id === frame.previousAimTargetId ? -240 : 0;
  return focusPriority + retainedPriority + getLineScoreAdjustment(frame, enemy, "pulse");
}

function getLineScoreAdjustment(
  frame: AutoPilotFrame,
  target: Enemy,
  weaponType: "pulse" | "pierce",
): number {
  const lane = analyzeFiringLane(
    frame,
    frame.world.player.position,
    target,
    weaponType,
  );
  if (lane.targetIndex < 0) return 0;
  if (lane.targetIndex >= lane.hitCapacity) return 520;

  const additionalHits = Math.max(0, lane.reachableHits - 1);
  const frontTargetBonus = lane.targetIndex === 0 ? -35 : 0;
  return -additionalHits * 145 + frontTargetBonus;
}

function analyzeFiringLane(
  frame: AutoPilotFrame,
  origin: Vec2,
  target: Enemy,
  weaponType: "pulse" | "pierce",
): { targetIndex: number; hitCapacity: number; reachableHits: number } {
  const targetOffset = subtract(target.position, origin);
  const targetDistanceSquared = lengthSquared(targetOffset);
  const weapon = frame.config.weapons[weaponType];
  const hitCapacity = weapon.hitCapacity + frame.world.runtime.hitCapacityBonus;
  if (targetDistanceSquared < 1) {
    return { targetIndex: 0, hitCapacity, reachableHits: 1 };
  }

  const targetDistance = Math.sqrt(targetDistanceSquared);
  const direction = {
    x: targetOffset.x / targetDistance,
    y: targetOffset.y / targetDistance,
  };
  const effectiveRange =
    weapon.speed *
    frame.world.runtime.projectileSpeedMultiplier *
    weapon.lifetime *
    0.94;
  const intersections = frame.world.enemies
    .flatMap((enemy) => {
      if (!enemy.enteredArena) return [];
      const offset = subtract(enemy.position, origin);
      const projection = dot(offset, direction);
      if (projection <= 0 || projection > effectiveRange + enemy.radius) return [];
      const perpendicularSquared = Math.max(0, lengthSquared(offset) - projection * projection);
      const tolerance = enemy.radius + weapon.radius + 7;
      if (perpendicularSquared > tolerance * tolerance) return [];
      const rayPoint = {
        x: origin.x + direction.x * projection,
        y: origin.y + direction.y * projection,
      };
      if (
        !hasClearNavigationPath(
          origin,
          rayPoint,
          weapon.radius,
          frame.world.obstacles,
        )
      ) return [];
      return [{ enemy, projection }];
    })
    .sort((first, second) => first.projection - second.projection);
  const targetIndex = intersections.findIndex(({ enemy }) => enemy.id === target.id);
  const reachableHits = Math.min(hitCapacity, intersections.length);
  return { targetIndex, hitCapacity, reachableHits };
}

function subtract(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x - second.x, y: first.y - second.y };
}
