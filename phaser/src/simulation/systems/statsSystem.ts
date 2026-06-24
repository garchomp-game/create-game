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
    } else if (event.type === "pickup.collected") {
      world.stats.pickupsCollected += 1;
      world.stats.xpCollected += event.xpValue;
    } else if (event.type === "upgrade.selected") {
      world.stats.upgradesChosen += 1;
    }
  }
}
