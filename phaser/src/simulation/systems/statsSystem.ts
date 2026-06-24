import type { GameEvent, WorldState } from "../../domain/types";

export function updateRunStats(world: WorldState, events: GameEvent[]): void {
  for (const event of events) {
    if (event.type === "shot.fired") {
      world.stats.shotsFired += 1;
      world.stats.weaponMetrics[event.weaponType].shotsFired += 1;
      world.stats.weaponMetrics[event.weaponType].projectilesFired += event.projectileCount;
    } else if (event.type === "enemy.hit") {
      world.stats.weaponMetrics[event.weaponType].hits += 1;
    } else if (event.type === "enemy.killed") {
      world.stats.enemiesKilled += 1;
      world.stats.weaponMetrics[event.weaponType].kills += 1;
    } else if (event.type === "player.damaged") {
      world.stats.hitsTaken += 1;
      world.stats.damageTaken += event.damage;
      if (event.source) {
        world.stats.damageTakenBySource[event.source.kind] += event.damage;
        world.stats.lastDamageSource = { ...event.source };
      }
    } else if (event.type === "pickup.collected") {
      world.stats.pickupsCollected += 1;
      if (event.pickupKind === "xp") {
        world.stats.xpCollected += event.xpValue;
      } else {
        world.stats.healPickupsCollected += 1;
        world.stats.hpRecovered += event.hpRecovered;
        if (event.hpRecovered > 0) {
          world.stats.effectiveHealPickupsCollected += 1;
        }
      }
    } else if (event.type === "upgrade.selected") {
      world.stats.upgradesChosen += 1;
    }
  }
}
