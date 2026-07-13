import type { SimulationConfig } from "../domain/types";

export type ThreatMultipliers = {
  hp: number;
  damage: number;
  score: number;
  projectileSpeed: number;
  attackSpeed: number;
  healDrop: number;
};

export function getThreatTier(config: SimulationConfig, elapsed: number): number {
  if (elapsed < config.threat.statStartAt) return 0;
  return 1 + Math.floor((elapsed - config.threat.statStartAt) / config.threat.statStepSeconds);
}

export function getThreatMultipliers(
  config: SimulationConfig,
  elapsed: number,
): ThreatMultipliers {
  const exponent = Math.max(0, getThreatTier(config, elapsed) - 1);
  return {
    hp: config.threat.enemyHpGrowth ** exponent,
    damage: config.threat.enemyDamageGrowth ** exponent,
    score: config.threat.enemyScoreGrowth ** exponent,
    projectileSpeed: Math.min(
      config.threat.maximumProjectileSpeedMultiplier,
      config.threat.rangedProjectileSpeedGrowth ** exponent,
    ),
    attackSpeed: Math.min(
      config.threat.maximumAttackSpeedMultiplier,
      config.threat.rangedAttackSpeedGrowth ** exponent,
    ),
    healDrop: Math.max(
      config.threat.minimumHealDropMultiplier,
      config.threat.healDropDecay ** exponent,
    ),
  };
}

export function getPressureStep(config: SimulationConfig, elapsed: number): number {
  if (elapsed < config.threat.pressureStartAt) return 0;
  return Math.floor(
    (elapsed - config.threat.pressureStartAt) / config.threat.pressureStepSeconds,
  );
}
