import {
  ENCOUNTER_IDS,
  type EncounterId,
  type GameEvent,
  type WorldState,
} from "../domain/types";
import {
  ENCOUNTER_RELIEF_SCHEMA_VERSION,
  ENCOUNTER_RELIEF_WINDOW_SECONDS,
  type EncounterReliefBoardDelta,
  type EncounterReliefBoardSnapshot,
  type EncounterReliefEpisode,
  type EncounterReliefNextWarning,
  type EncounterReliefReport,
  type EncounterReliefWindowMetrics,
} from "../domain/encounterRelief";

type MutableEpisode = {
  encounterId: EncounterId;
  occurrence: number;
  windowStartedAt: number;
  targetEndsAt: number;
  startBoard: EncounterReliefBoardSnapshot;
  endBoard: EncounterReliefBoardSnapshot | null;
  metrics: EncounterReliefWindowMetrics;
  nextWarning: EncounterReliefNextWarning | null;
};

export class EncounterReliefMonitor {
  private episodes: MutableEpisode[] = [];
  private occurrences = emptyEncounterCounts();
  private latestBoard: EncounterReliefBoardSnapshot | null = null;

  reset(world: WorldState): void {
    this.episodes = [];
    this.occurrences = emptyEncounterCounts();
    this.latestBoard = captureBoard(world, finiteNonNegative(world.state.elapsed));
  }

  observe(world: WorldState, sourceEvents: readonly GameEvent[]): void {
    const observedAt = finiteNonNegative(world.state.elapsed);
    const currentBoard = captureBoard(world, observedAt);

    for (const event of sourceEvents) {
      const elapsed = eventElapsed(event, observedAt);
      if (event.type === "encounter.recovery.started") {
        this.startEpisode(event.encounterId, elapsed, currentBoard);
        continue;
      }
      if (event.type === "encounter.warning.started") {
        this.attachNextWarning(event.encounterId, elapsed, currentBoard);
        continue;
      }
      this.recordWindowEvent(event, elapsed);
    }

    this.latestBoard = currentBoard;
    for (const episode of this.episodes) {
      if (episode.endBoard === null && observedAt >= episode.targetEndsAt) {
        episode.endBoard = cloneBoard(currentBoard);
      }
    }
  }

  getReport(observedUntil: number): EncounterReliefReport {
    if (this.episodes.length === 0 || this.latestBoard === null) {
      return {
        schemaVersion: ENCOUNTER_RELIEF_SCHEMA_VERSION,
        windowSeconds: ENCOUNTER_RELIEF_WINDOW_SECONDS,
        state: "not-reached",
        reason: "recoveryNotObserved",
      };
    }

    const episodes = this.episodes.map((episode) =>
      createEpisode(episode, this.latestBoard!),
    );
    const complete = episodes.filter((episode) => episode.windowState === "complete");
    const completeWindowTotals = complete.reduce(
      (totals, episode) => addMetrics(totals, episode.metrics),
      emptyMetrics(),
    );

    return {
      schemaVersion: ENCOUNTER_RELIEF_SCHEMA_VERSION,
      windowSeconds: ENCOUNTER_RELIEF_WINDOW_SECONDS,
      state: "available",
      observedUntil: finiteNonNegative(observedUntil),
      summary: {
        episodeCount: episodes.length,
        completeWindowCount: complete.length,
        partialWindowCount: episodes.length - complete.length,
        nextWarningObservedCount: episodes.filter((episode) => episode.nextWarning !== null).length,
        completeWindowTotals,
        completeWindowRepairOffsetRate: ratio(
          completeWindowTotals.hpRecovered,
          completeWindowTotals.damageTaken,
        ),
      },
      episodes,
    };
  }

  private startEpisode(
    encounterId: EncounterId,
    elapsed: number,
    board: EncounterReliefBoardSnapshot,
  ): void {
    const occurrence = ++this.occurrences[encounterId];
    this.episodes.push({
      encounterId,
      occurrence,
      windowStartedAt: elapsed,
      targetEndsAt: elapsed + ENCOUNTER_RELIEF_WINDOW_SECONDS,
      startBoard: cloneBoard(board),
      endBoard: null,
      metrics: emptyMetrics(),
      nextWarning: null,
    });
  }

  private attachNextWarning(
    encounterId: EncounterId,
    elapsed: number,
    board: EncounterReliefBoardSnapshot,
  ): void {
    const episode = findLastEpisode(
      this.episodes,
      (candidate) =>
        candidate.nextWarning === null && elapsed > candidate.windowStartedAt,
    );
    if (!episode) return;
    episode.nextWarning = {
      encounterId,
      elapsed,
      secondsAfterRecoveryStarted: elapsed - episode.windowStartedAt,
      board: cloneBoard(board),
    };
  }

  private recordWindowEvent(event: GameEvent, elapsed: number): void {
    const episode = findLastEpisode(
      this.episodes,
      (candidate) =>
        candidate.endBoard === null &&
        elapsed >= candidate.windowStartedAt && elapsed <= candidate.targetEndsAt,
    );
    if (!episode) return;

    if (event.type === "player.damaged") {
      episode.metrics.damageTaken += event.damage;
    } else if (event.type === "pickup.collected" && event.pickupKind === "xp") {
      episode.metrics.xpCollected += event.xpValue;
    } else if (event.type === "pickup.collected" && event.pickupKind === "heal") {
      episode.metrics.hpRecovered += event.hpRecovered;
      episode.metrics.repairPickupsCollected += 1;
      if (event.hpRecovered === 0) {
        episode.metrics.repairPickupsCollectedAtFullHp += 1;
      }
    } else if (event.type === "enemy.killed") {
      episode.metrics.regularEnemiesKilled += 1;
    }
  }
}

function createEpisode(
  source: MutableEpisode,
  latestBoard: EncounterReliefBoardSnapshot,
): EncounterReliefEpisode {
  const endBoard = cloneBoard(source.endBoard ?? latestBoard);
  const metrics = { ...source.metrics };
  return {
    episodeId: `${source.encounterId}:${source.occurrence}`,
    encounterId: source.encounterId,
    occurrence: source.occurrence,
    windowStartedAt: source.windowStartedAt,
    targetEndsAt: source.targetEndsAt,
    observedUntil: endBoard.observedAt,
    windowState: source.endBoard ? "complete" : "partial",
    startBoard: cloneBoard(source.startBoard),
    endBoard,
    boardDelta: subtractBoard(endBoard, source.startBoard),
    metrics,
    repairOffsetRate: ratio(metrics.hpRecovered, metrics.damageTaken),
    nextWarning: source.nextWarning
      ? { ...source.nextWarning, board: cloneBoard(source.nextWarning.board) }
      : null,
  };
}

function captureBoard(world: WorldState, observedAt: number): EncounterReliefBoardSnapshot {
  let groundXpCount = 0;
  let groundXpValue = 0;
  let groundRepairCount = 0;
  let groundRepairValue = 0;
  for (const pickup of world.pickups) {
    if (pickup.kind === "xp") {
      groundXpCount += 1;
      groundXpValue += pickup.xpValue;
    } else {
      groundRepairCount += 1;
      groundRepairValue += pickup.healValue;
    }
  }
  return {
    observedAt,
    playerHp: world.state.hp,
    enemyCount: world.enemies.length,
    enemyProjectileCount: world.enemyProjectiles.length,
    groundXpCount,
    groundXpValue,
    groundRepairCount,
    groundRepairValue,
  };
}

function subtractBoard(
  end: EncounterReliefBoardSnapshot,
  start: EncounterReliefBoardSnapshot,
): EncounterReliefBoardDelta {
  return {
    playerHp: end.playerHp - start.playerHp,
    enemyCount: end.enemyCount - start.enemyCount,
    enemyProjectileCount: end.enemyProjectileCount - start.enemyProjectileCount,
    groundXpCount: end.groundXpCount - start.groundXpCount,
    groundXpValue: end.groundXpValue - start.groundXpValue,
    groundRepairCount: end.groundRepairCount - start.groundRepairCount,
    groundRepairValue: end.groundRepairValue - start.groundRepairValue,
  };
}

function emptyEncounterCounts(): Record<EncounterId, number> {
  return Object.fromEntries(ENCOUNTER_IDS.map((id) => [id, 0])) as Record<EncounterId, number>;
}

function emptyMetrics(): EncounterReliefWindowMetrics {
  return {
    xpCollected: 0,
    damageTaken: 0,
    hpRecovered: 0,
    repairPickupsCollected: 0,
    repairPickupsCollectedAtFullHp: 0,
    regularEnemiesKilled: 0,
  };
}

function addMetrics(
  left: EncounterReliefWindowMetrics,
  right: EncounterReliefWindowMetrics,
): EncounterReliefWindowMetrics {
  return {
    xpCollected: left.xpCollected + right.xpCollected,
    damageTaken: left.damageTaken + right.damageTaken,
    hpRecovered: left.hpRecovered + right.hpRecovered,
    repairPickupsCollected:
      left.repairPickupsCollected + right.repairPickupsCollected,
    repairPickupsCollectedAtFullHp:
      left.repairPickupsCollectedAtFullHp + right.repairPickupsCollectedAtFullHp,
    regularEnemiesKilled: left.regularEnemiesKilled + right.regularEnemiesKilled,
  };
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function eventElapsed(event: GameEvent, fallback: number): number {
  return "elapsed" in event && typeof event.elapsed === "number"
    ? finiteNonNegative(event.elapsed)
    : fallback;
}

function cloneBoard(board: EncounterReliefBoardSnapshot): EncounterReliefBoardSnapshot {
  return { ...board };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function findLastEpisode(
  episodes: readonly MutableEpisode[],
  predicate: (episode: MutableEpisode) => boolean,
): MutableEpisode | undefined {
  for (let index = episodes.length - 1; index >= 0; index -= 1) {
    const episode = episodes[index]!;
    if (predicate(episode)) return episode;
  }
  return undefined;
}
