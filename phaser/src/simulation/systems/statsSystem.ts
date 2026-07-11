import type { GameEvent, WorldState } from "../../domain/types";

export function updateRunStats(world: WorldState, events: GameEvent[]): void {
  for (const event of events) {
    if (event.type === "shot.fired") {
      world.stats.shotsFired += 1;
      world.stats.weaponMetrics[event.weaponType].shotsFired += 1;
      world.stats.weaponMetrics[event.weaponType].projectilesFired += event.projectileCount;
      world.analytics.activeVolleys[event.volleyId] = {
        weaponType: event.weaponType,
        enemyIds: [],
        postRicochetEnemyIds: [],
      };
    } else if (event.type === "enemy.hit") {
      const weaponStats = world.stats.weaponMetrics[event.weaponType];
      const comparisonStats = world.stats.weaponComparisonMetrics[event.weaponType];
      weaponStats.hits += 1;
      comparisonStats.hitsByEnemyType[event.enemyType] += 1;
      const volley = (world.analytics.activeVolleys[event.volleyId] ??= {
        weaponType: event.weaponType,
        enemyIds: [],
        postRicochetEnemyIds: [],
      });
      if (!volley.enemyIds.includes(event.enemyId)) {
        if (volley.enemyIds.length === 0) comparisonStats.hitVolleys += 1;
        volley.enemyIds.push(event.enemyId);
        comparisonStats.uniqueEnemiesHit += 1;
        comparisonStats.maxUniqueEnemiesHitPerVolley = Math.max(
          comparisonStats.maxUniqueEnemiesHitPerVolley,
          volley.enemyIds.length,
        );
      }
      if (event.ricochetsUsed > 0) {
        world.stats.capstoneMetrics.followUpHits += 1;
        if (!volley.postRicochetEnemyIds.includes(event.enemyId)) {
          volley.postRicochetEnemyIds.push(event.enemyId);
          world.stats.capstoneMetrics.followUpUniqueEnemiesHit += 1;
          world.stats.capstoneMetrics.maxFollowUpUniqueEnemiesPerVolley = Math.max(
            world.stats.capstoneMetrics.maxFollowUpUniqueEnemiesPerVolley,
            volley.postRicochetEnemyIds.length,
          );
        }
      }
    } else if (event.type === "bullet.ricocheted") {
      world.stats.capstoneMetrics.activations += 1;
    } else if (event.type === "enemy.killed") {
      world.stats.enemiesKilled += 1;
      const weaponStats = world.stats.weaponMetrics[event.weaponType];
      weaponStats.kills += 1;
      world.stats.weaponComparisonMetrics[event.weaponType].killsByEnemyType[event.enemyType] += 1;
      if (world.encounter.rangedSurge.phase === "active") {
        world.stats.encounterMetrics.killsDuringActiveByEnemyType[event.enemyType] += 1;
      }
    } else if (event.type === "enemy.spawned") {
      if (world.encounter.rangedSurge.phase === "active" && event.enemyType === "ranged") {
        world.stats.encounterMetrics.rangedEnemiesSpawned += 1;
      }
    } else if (event.type === "player.damaged") {
      world.stats.hitsTaken += 1;
      world.stats.damageTaken += event.damage;
      if (event.source) {
        world.stats.damageTakenBySource[event.source.kind] += event.damage;
        world.stats.lastDamageSource = { ...event.source };
      }
      if (world.encounter.rangedSurge.phase === "active") {
        world.stats.encounterMetrics.damageTakenDuringActive += event.damage;
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
    } else if (event.type === "upgrade.offered") {
      const progression = world.stats.progressionMetrics;
      progression.firstOfferAt ??= world.state.elapsed;
      progression.offers.push({
        elapsed: world.state.elapsed,
        level: event.level,
        choices: [...event.choices],
        availableUpgradeIds: [...event.availableUpgradeIds],
        lockedUpgradeIds: [...event.lockedUpgradeIds],
        maxedUpgradeIds: [...event.maxedUpgradeIds],
      });
    } else if (event.type === "upgrade.selected") {
      world.stats.upgradesChosen += 1;
      const progression = world.stats.progressionMetrics;
      progression.firstSelectionAt ??= world.state.elapsed;
      progression.longestMeaningfulChoiceGap = Math.max(
        progression.longestMeaningfulChoiceGap,
        world.state.elapsed - (progression.lastSelectionAt ?? 0),
      );
      progression.lastSelectionAt = world.state.elapsed;
      progression.selections.push({
        elapsed: world.state.elapsed,
        level: event.level,
        upgradeId: event.upgradeId,
        rank: event.rank,
      });
      if (event.upgradeId === "pulseRicochet") {
        world.stats.capstoneMetrics.acquiredAt = world.state.elapsed;
      }
    } else if (event.type === "build.completed") {
      world.stats.progressionMetrics.buildCompletedAt = event.elapsed;
    } else if (event.type === "encounter.scheduled") {
      world.stats.encounterMetrics.scheduledAt = event.scheduledAt;
    } else if (event.type === "encounter.warning.started") {
      world.stats.encounterMetrics.warningStartedAt = event.elapsed;
    } else if (event.type === "encounter.started") {
      world.stats.encounterMetrics.activeStartedAt = event.elapsed;
    } else if (event.type === "encounter.recovery.started") {
      world.stats.encounterMetrics.recoveryStartedAt = event.elapsed;
    } else if (event.type === "encounter.completed") {
      world.stats.encounterMetrics.completedAt = event.elapsed;
    } else if (event.type === "contract.offered") {
      world.stats.encounterMetrics.contractOfferedAt = event.elapsed;
    } else if (event.type === "contract.selected") {
      world.stats.encounterMetrics.contractSelectedAt = event.elapsed;
      world.stats.encounterMetrics.contractChoice = event.choice;
    }
  }

  const progression = world.stats.progressionMetrics;
  const gapEnd = progression.buildCompletedAt ?? world.state.elapsed;
  const currentChoiceGap = gapEnd - (progression.lastSelectionAt ?? 0);
  progression.longestMeaningfulChoiceGap = Math.max(
    progression.longestMeaningfulChoiceGap,
    currentChoiceGap,
  );

  const activeVolleyIds = new Set(world.bullets.map((bullet) => String(bullet.volleyId)));
  for (const volleyId of Object.keys(world.analytics.activeVolleys)) {
    if (!activeVolleyIds.has(volleyId)) delete world.analytics.activeVolleys[volleyId];
  }
}
