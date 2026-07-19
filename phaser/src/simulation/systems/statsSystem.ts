import {
  BOSS_ATTACK_IDS,
  type BossAttackId,
  type GameEvent,
  type WorldState,
} from "../../domain/types";

export function updateRunStats(world: WorldState, events: GameEvent[]): void {
  for (const event of events) {
    if (event.type === "shot.fired") {
      world.stats.shotsFired += 1;
      world.stats.weaponMetrics[event.weaponType].shotsFired += 1;
      world.stats.weaponMetrics[event.weaponType].projectilesFired += event.projectileCount;
      world.analytics.activeVolleys[event.volleyId] ??= {
        weaponType: event.weaponType,
        enemyIds: [],
        postRicochetEnemyIds: [],
        spreadSweepEnemyIds: [],
        spreadSweepTriggered: false,
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
        spreadSweepEnemyIds: [],
        spreadSweepTriggered: false,
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
        const capstone = world.stats.capstoneMetrics;
        capstone.followUpHits += 1;
        if (event.ricochetSurfaceKind === "obstacle") {
          capstone.obstacleFollowUpHits += 1;
          if (event.hpAfter <= 0) capstone.obstacleFollowUpKills += 1;
        } else if (event.ricochetSurfaceKind === "arenaBoundary") {
          capstone.boundaryFollowUpHits += 1;
          if (event.hpAfter <= 0) capstone.boundaryFollowUpKills += 1;
          if (event.ricochetBoundarySide) {
            capstone.boundaryFollowUpHitsBySide[event.ricochetBoundarySide] += 1;
          }
        }
        if (!volley.postRicochetEnemyIds.includes(event.enemyId)) {
          volley.postRicochetEnemyIds.push(event.enemyId);
          capstone.followUpUniqueEnemiesHit += 1;
          capstone.maxFollowUpUniqueEnemiesPerVolley = Math.max(
            capstone.maxFollowUpUniqueEnemiesPerVolley,
            volley.postRicochetEnemyIds.length,
          );
        }
      }
    } else if (event.type === "bullet.ricocheted") {
      world.stats.capstoneMetrics.activations += 1;
      if (event.surfaceKind === "obstacle") {
        world.stats.capstoneMetrics.obstacleRicochets += 1;
      } else if (event.boundarySide) {
        world.stats.capstoneMetrics.boundaryRicochets += 1;
        world.stats.capstoneMetrics.boundaryRicochetsBySide[event.boundarySide] += 1;
      }
    } else if (event.type === "pulse.focus.hit") {
      const metrics = world.stats.weaponIdentityMetrics.pulseFocus;
      if (event.bonusDamage > 0) metrics.enhancedHits += 1;
      if (event.targetBonusDamage > 0) metrics.targetEnhancedHits += 1;
      if (event.lineBonusDamage > 0) metrics.lineEnhancedHits += 1;
      metrics.bonusDamage += event.bonusDamage;
      metrics.targetBonusDamage += event.targetBonusDamage;
      metrics.lineBonusDamage += event.lineBonusDamage;
      metrics.maxStacks = Math.max(metrics.maxStacks, event.stackAfter);
      if (event.killed && (event.stackBefore > 0 || event.lineStacks > 0)) {
        metrics.killsByEnemyType[event.enemyType] += 1;
      }
    } else if (event.type === "spread.sweep.triggered") {
      world.stats.capstoneMetrics.activations += 1;
      world.stats.capstoneMetrics.spreadSweepTriggers += 1;
      const metrics = world.stats.weaponIdentityMetrics.spreadSweep;
      metrics.triggers += 1;
      metrics.maxDistinctTargets = Math.max(metrics.maxDistinctTargets, event.distinctTargets);
    } else if (event.type === "spread.sweep.consumed") {
      world.stats.capstoneMetrics.spreadSweepConsumes += 1;
      world.stats.weaponIdentityMetrics.spreadSweep.consumes += 1;
    } else if (event.type === "enemy.killed") {
      world.stats.enemiesKilled += 1;
      const weaponStats = world.stats.weaponMetrics[event.weaponType];
      weaponStats.kills += 1;
      world.stats.weaponComparisonMetrics[event.weaponType].killsByEnemyType[event.enemyType] += 1;
      if (world.encounter.director.phase === "active") {
        world.stats.encounterMetrics.killsDuringActiveByEnemyType[event.enemyType] += 1;
      }
      if (world.expedition?.boss?.status === "active") {
        getBossMetrics(world).killsDuringBoss += 1;
      }
    } else if (event.type === "enemy.spawned") {
      if (world.encounter.director.phase === "active" && event.enemyType === "ranged") {
        world.stats.encounterMetrics.rangedEnemiesSpawned += 1;
      }
    } else if (event.type === "elite.commander.spawned") {
      getCommanderMetrics(world).spawned += 1;
    } else if (event.type === "elite.commander.reinforcement.telegraphed") {
      getCommanderMetrics(world).telegraphs += 1;
    } else if (event.type === "elite.commander.reinforcement.deployed") {
      const metrics = getCommanderMetrics(world);
      metrics.traitActivations += 1;
      metrics.reinforcementsSpawned += event.reinforcementIds.length;
    } else if (event.type === "elite.commander.killed") {
      const metrics = getCommanderMetrics(world);
      metrics.killed += 1;
      metrics.lifetimeTotal += event.lifetime;
      metrics.killsByWeapon[event.weaponType] += 1;
    } else if (event.type === "elite.commander.pressure.lowered") {
      const metrics = getCommanderMetrics(world);
      metrics.pressureReleases += 1;
      metrics.supportUnitsReleased += event.releasedEnemyIds.length;
    } else if (event.type === "enemy.charger.spawned") {
      getChargerMetrics(world).spawned += 1;
    } else if (event.type === "enemy.charger.telegraph.started") {
      getChargerMetrics(world).telegraphs += 1;
    } else if (event.type === "enemy.charger.charge.started") {
      getChargerMetrics(world).charges += 1;
    } else if (event.type === "enemy.charger.charge.ended") {
      const metrics = getChargerMetrics(world);
      if (!event.hitPlayer) metrics.avoided += 1;
      if (event.reason === "obstacle") metrics.obstacleInterruptions += 1;
      if (event.reason === "arenaBoundary") metrics.boundaryInterruptions += 1;
    } else if (event.type === "enemy.charger.recovered") {
      getChargerMetrics(world).recoveries += 1;
    } else if (event.type === "enemy.charger.player.hit") {
      getChargerMetrics(world).playerHits += 1;
    } else if (event.type === "enemy.charger.killed") {
      const metrics = getChargerMetrics(world);
      metrics.killed += 1;
      metrics.killsByWeapon[event.weaponType] += 1;
    } else if (event.type === "player.damaged") {
      world.stats.hitsTaken += 1;
      world.stats.damageTaken += event.damage;
      if (isBossEncounterActive(world)) {
        getBossMetrics(world).damageTakenDuringBoss += event.damage;
      }
      if (event.source) {
        world.stats.damageTakenBySource[event.source.kind] += event.damage;
        world.stats.lastDamageSource = { ...event.source };
      }
      if (world.encounter.director.phase === "active") {
        world.stats.encounterMetrics.damageTakenDuringActive += event.damage;
      }
      if (event.source?.kind === "collapse") {
        world.stats.encounterMetrics.collapseDamageTaken += event.damage;
      }
      if (
        event.source &&
        event.source.kind !== "collapse" &&
        event.source.bossAttackId
      ) {
        const boss = getBossMetrics(world);
        boss.playerHitsByAttack[event.source.bossAttackId] += 1;
        boss.damageTakenByAttack[event.source.bossAttackId] += event.damage;
      }
    } else if (event.type === "pickup.spawned") {
      if (event.pickupKind === "heal" && isBossEncounterActive(world)) {
        const boss = getBossMetrics(world);
        boss.healPickupsSpawned += 1;
        boss.healValueSuppliedDuringBoss += event.healValue;
        if (boss.repairBudgetInitial !== null) {
          boss.repairBudgetSpent += event.healValue;
          boss.repairBudgetRemaining = Math.max(
            0,
            boss.repairBudgetInitial - boss.repairBudgetSpent,
          );
        }
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
        if (isBossEncounterActive(world)) {
          const boss = getBossMetrics(world);
          boss.healPickupsCollected += 1;
          if (event.hpRecovered === 0) {
            boss.healPickupsCollectedAtFullHp += 1;
          }
          boss.hpRecoveredDuringBoss += event.hpRecovered;
        }
      }
    } else if (
      event.type === "pickup.expired" &&
      event.pickupKind === "heal" &&
      isBossEncounterActive(world)
    ) {
      getBossMetrics(world).healPickupsExpired += 1;
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
      if (event.upgradeId === "pulseRicochet" || event.upgradeId === "spreadSweep") {
        world.stats.capstoneMetrics.upgradeId = event.upgradeId;
        world.stats.capstoneMetrics.acquiredAt = world.state.elapsed;
      }
    } else if (event.type === "extra.upgrade.offered") {
      world.stats.progressionMetrics.extraOffers += 1;
    } else if (event.type === "extra.upgrade.selected") {
      world.stats.upgradesChosen += 1;
      world.stats.extraUpgradesChosen += 1;
      world.stats.progressionMetrics.extraSelections.push({
        elapsed: world.state.elapsed,
        level: event.level,
        extraLevel: event.extraLevel,
        cycle: event.cycle,
        automatic: event.automatic,
        extraUpgradeId: event.extraUpgradeId,
        rank: event.rank,
      });
    } else if (event.type === "build.completed") {
      world.stats.progressionMetrics.buildCompletedAt = event.elapsed;
      world.stats.progressionMetrics.extraStartedAt = event.elapsed;
    } else if (event.type === "encounter.scheduled") {
      world.stats.encounterMetrics.scheduledAt ??= event.scheduledAt;
    } else if (event.type === "encounter.warning.started") {
      world.stats.encounterMetrics.warningStartedAt ??= event.elapsed;
    } else if (event.type === "encounter.started") {
      world.stats.encounterMetrics.activeStartedAt ??= event.elapsed;
      world.stats.encounterMetrics.eventCounts[event.encounterId] += 1;
    } else if (event.type === "encounter.recovery.started") {
      world.stats.encounterMetrics.recoveryStartedAt ??= event.elapsed;
    } else if (event.type === "encounter.completed") {
      world.stats.encounterMetrics.completedAt = event.elapsed;
      world.stats.encounterMetrics.eventsCompleted += 1;
    } else if (event.type === "expedition.act.changed") {
      const metrics = getExpeditionMetrics(world);
      metrics.actChanges += 1;
      metrics.reachedActId = event.actId;
      if (!metrics.reachedActIds.includes(event.actId)) {
        metrics.reachedActIds.push(event.actId);
      }
    } else if (event.type === "expedition.encounter.selected") {
      const metrics = getExpeditionMetrics(world);
      metrics.cardsSelected += 1;
      metrics.longestMeaningfulGap =
        world.expedition?.director.metrics.longestMeaningfulGap ??
        metrics.longestMeaningfulGap;
    } else if (event.type === "expedition.encounter.completed") {
      const metrics = getExpeditionMetrics(world);
      metrics.cardsCompleted += 1;
      syncExpeditionCardHistory(world, metrics);
    } else if (event.type === "expedition.encounter.failed") {
      const metrics = getExpeditionMetrics(world);
      metrics.cardsFailed += 1;
      syncExpeditionCardHistory(world, metrics);
    } else if (event.type === "expedition.encounter.interrupted") {
      const metrics = getExpeditionMetrics(world);
      metrics.cardsInterrupted += 1;
      syncExpeditionCardHistory(world, metrics);
    } else if (event.type === "expedition.encounter.deferred") {
      getExpeditionMetrics(world).cardsDeferred += 1;
    } else if (event.type === "expedition.spawn.deployed") {
      getExpeditionMetrics(world).structuredEnemiesSpawned += event.enemyIds.length;
    } else if (event.type === "expedition.spawn.deferred") {
      getExpeditionMetrics(world).structuredSpawnsDeferred += 1;
    } else if (event.type === "boss.spawned") {
      const metrics = getBossMetrics(world);
      metrics.bossId = event.bossId;
      metrics.spawnedAt = event.elapsed;
      metrics.remainingHp = event.maximumHp;
      metrics.maximumHp = event.maximumHp;
      metrics.phaseReached = 1;
      metrics.repairBudgetInitial = event.repairBudgetInitial;
      metrics.repairBudgetRemaining = event.repairBudgetInitial;
    } else if (event.type === "boss.phase.changed") {
      const metrics = getBossMetrics(world);
      metrics.phaseReached = event.phase;
      metrics.phaseChanges += 1;
    } else if (event.type === "boss.attack.telegraphed") {
      getBossMetrics(world).attacksTelegraphed[event.attackId] += 1;
    } else if (event.type === "boss.attack.executed") {
      const metrics = getBossMetrics(world);
      metrics.attacksExecuted[event.attackId] += 1;
      metrics.lastAttackId = event.attackId;
    } else if (event.type === "boss.command-pulse.resolved") {
      getBossMetrics(world).commandPulseResults[event.result] += 1;
    } else if (event.type === "boss.heal-drop.suppressed") {
      const metrics = getBossMetrics(world);
      metrics.healDropsSuppressed += event.count;
      metrics.healDropsSuppressedByReason[event.reason] += event.count;
    } else if (event.type === "boss.escort.deployed") {
      getBossMetrics(world).escortsSpawned += event.enemyIds.length;
    } else if (event.type === "boss.defeated") {
      const metrics = getBossMetrics(world);
      metrics.defeatedAt = event.elapsed;
      metrics.remainingHp = 0;
      metrics.defeatedByWeapon = event.weaponType;
    } else if (
      event.type === "expedition.completed" ||
      event.type === "expedition.failed"
    ) {
      const metrics = getExpeditionMetrics(world);
      metrics.outcome = event.type === "expedition.completed" ? "victory" : "defeat";
      metrics.reachedActId = event.actId;
      metrics.completedAt = event.elapsed;
      metrics.tacticalScore = event.tacticalScore;
      metrics.scoreBeforeBonus = event.scoreBeforeBonus;
      metrics.clearScoreBonus = event.clearScoreBonus;
      metrics.timeScoreBonus = event.timeScoreBonus;
      metrics.timeMedal = event.timeMedal;
      metrics.bossFightDuration = event.bossFightDuration;
    } else if (event.type === "collapse.advanced") {
      world.stats.encounterMetrics.collapseStartedAt ??= event.elapsed;
      world.stats.encounterMetrics.peakCollapseStage = Math.max(
        world.stats.encounterMetrics.peakCollapseStage,
        event.stage,
      );
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

  const activeBoss = world.expedition?.boss;
  if (activeBoss) {
    const enemy = world.enemies.find((candidate) => candidate.id === activeBoss.enemyId);
    if (enemy) getBossMetrics(world).remainingHp = Math.max(0, enemy.hp);
  }
}

function getCommanderMetrics(world: WorldState) {
  return (world.stats.encounterMetrics.commander ??= {
    spawned: 0,
    killed: 0,
    telegraphs: 0,
    traitActivations: 0,
    reinforcementsSpawned: 0,
    pressureReleases: 0,
    supportUnitsReleased: 0,
    lifetimeTotal: 0,
    killsByWeapon: { pulse: 0, spread: 0, pierce: 0 },
  });
}

function getChargerMetrics(world: WorldState) {
  return (world.stats.encounterMetrics.charger ??= {
    spawned: 0,
    telegraphs: 0,
    charges: 0,
    playerHits: 0,
    avoided: 0,
    obstacleInterruptions: 0,
    boundaryInterruptions: 0,
    recoveries: 0,
    killed: 0,
    killsByWeapon: { pulse: 0, spread: 0, pierce: 0 },
  });
}

function getExpeditionMetrics(world: WorldState) {
  return (world.stats.encounterMetrics.expedition ??= {
    outcome: null,
    reachedActId: null,
    reachedActIds: [],
    actChanges: 0,
    cardsSelected: 0,
    cardsCompleted: 0,
    cardsFailed: 0,
    cardsInterrupted: 0,
    cardsDeferred: 0,
    structuredEnemiesSpawned: 0,
    structuredSpawnsDeferred: 0,
    longestMeaningfulGap: 0,
    completedAt: null,
    tacticalScore: 0,
    scoreBeforeBonus: 0,
    clearScoreBonus: 0,
    timeScoreBonus: 0,
    timeMedal: null,
    bossFightDuration: null,
    cardHistory: [],
  });
}

function syncExpeditionCardHistory(
  world: WorldState,
  metrics: NonNullable<WorldState["stats"]["encounterMetrics"]["expedition"]>,
): void {
  metrics.cardHistory = structuredClone(world.expedition?.director.history ?? []);
}

function getBossMetrics(world: WorldState) {
  return (world.stats.encounterMetrics.boss ??= {
    bossId: null,
    spawnedAt: null,
    defeatedAt: null,
    remainingHp: null,
    maximumHp: null,
    phaseReached: 0,
    phaseChanges: 0,
    lastAttackId: null,
    attacksTelegraphed: createBossAttackCounts(),
    attacksExecuted: createBossAttackCounts(),
    playerHitsByAttack: createBossAttackCounts(),
    damageTakenByAttack: createBossAttackCounts(),
    escortsSpawned: 0,
    killsDuringBoss: 0,
    damageTakenDuringBoss: 0,
    healPickupsSpawned: 0,
    healValueSuppliedDuringBoss: 0,
    healDropsSuppressed: 0,
    healDropsSuppressedByReason: {
      cooldown: 0,
      "repair-budget-exhausted": 0,
    },
    healPickupsCollected: 0,
    healPickupsCollectedAtFullHp: 0,
    healPickupsExpired: 0,
    hpRecoveredDuringBoss: 0,
    repairBudgetInitial: null,
    repairBudgetSpent: 0,
    repairBudgetRemaining: null,
    commandPulseResults: { hit: 0, blocked: 0, outside: 0, invulnerable: 0 },
    defeatedByWeapon: null,
  });
}

function isBossEncounterActive(world: WorldState): boolean {
  const metrics = world.stats.encounterMetrics.boss;
  return Boolean(
    metrics && metrics.spawnedAt !== null && metrics.defeatedAt === null,
  );
}

function createBossAttackCounts(): Record<BossAttackId, number> {
  return Object.fromEntries(BOSS_ATTACK_IDS.map((id) => [id, 0])) as Record<
    BossAttackId,
    number
  >;
}
