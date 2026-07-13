import type { RunResultSummary, WorldState } from "../domain/types";
import { getThreatTier } from "./threatDirector";
import { SIMULATION_CONFIG } from "../config/gameConfig";

export function createRunResultSummary(
  world: WorldState,
  config = SIMULATION_CONFIG,
): RunResultSummary {
  return {
    elapsed: world.state.elapsed,
    score: world.state.score,
    hp: world.state.hp,
    level: world.progression.level,
    extraLevel: world.progression.extraLevel,
    extraCycle: world.progression.extraCycle,
    xp: world.progression.xp,
    threatTier: getThreatTier(config, world.state.elapsed),
    collapseStage: world.encounter.collapse.stage,
    shotsFired: world.stats.shotsFired,
    enemiesKilled: world.stats.enemiesKilled,
    hitsTaken: world.stats.hitsTaken,
    damageTaken: world.stats.damageTaken,
    damageTakenBySource: {
      contact: world.stats.damageTakenBySource.contact,
      projectile: world.stats.damageTakenBySource.projectile,
      collapse: world.stats.damageTakenBySource.collapse,
    },
    lastDamageSource: world.stats.lastDamageSource ? { ...world.stats.lastDamageSource } : null,
    xpCollected: world.stats.xpCollected,
    pickupsCollected: world.stats.pickupsCollected,
    hpRecovered: world.stats.hpRecovered,
    healPickupsCollected: world.stats.healPickupsCollected,
    effectiveHealPickupsCollected: world.stats.effectiveHealPickupsCollected,
    upgradesChosen: world.stats.upgradesChosen,
    extraUpgradesChosen: world.stats.extraUpgradesChosen,
    capstoneMetrics: { ...world.stats.capstoneMetrics },
    weaponMetrics: {
      pulse: { ...world.stats.weaponMetrics.pulse },
      spread: { ...world.stats.weaponMetrics.spread },
      pierce: { ...world.stats.weaponMetrics.pierce },
    },
  };
}
