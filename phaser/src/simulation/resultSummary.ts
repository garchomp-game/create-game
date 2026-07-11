import type { RunResultSummary, WorldState } from "../domain/types";

export function createRunResultSummary(world: WorldState): RunResultSummary {
  return {
    elapsed: world.state.elapsed,
    score: world.state.score,
    hp: world.state.hp,
    level: world.progression.level,
    xp: world.progression.xp,
    shotsFired: world.stats.shotsFired,
    enemiesKilled: world.stats.enemiesKilled,
    hitsTaken: world.stats.hitsTaken,
    damageTaken: world.stats.damageTaken,
    damageTakenBySource: {
      contact: world.stats.damageTakenBySource.contact,
      projectile: world.stats.damageTakenBySource.projectile,
    },
    lastDamageSource: world.stats.lastDamageSource ? { ...world.stats.lastDamageSource } : null,
    xpCollected: world.stats.xpCollected,
    pickupsCollected: world.stats.pickupsCollected,
    hpRecovered: world.stats.hpRecovered,
    healPickupsCollected: world.stats.healPickupsCollected,
    effectiveHealPickupsCollected: world.stats.effectiveHealPickupsCollected,
    upgradesChosen: world.stats.upgradesChosen,
    capstoneMetrics: { ...world.stats.capstoneMetrics },
    weaponMetrics: {
      pulse: { ...world.stats.weaponMetrics.pulse },
      spread: { ...world.stats.weaponMetrics.spread },
      pierce: { ...world.stats.weaponMetrics.pierce },
    },
  };
}
