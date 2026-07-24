import type {
  ObservedGameEvent,
  RunCompletionFact,
} from "../domain/runFacts";
import type {
  RunOutcomeBossProgress,
  RunOutcomeNearMissEvidence,
  RunOutcomeProgress,
} from "../domain/runOutcomeInsights";
import type { BossAttackId } from "../domain/types";

export function createRunOutcomeProgress(
  events: readonly ObservedGameEvent[],
  completion: RunCompletionFact,
): RunOutcomeProgress {
  const boss = createBossProgress(events, completion.elapsed);
  const pressure = createPressureSnapshot(events, completion.elapsed);
  return {
    completionKind: completion.kind,
    elapsed: completion.elapsed,
    score: completion.score,
    tacticalScore: completion.tacticalScore,
    actId: completion.actId,
    boss,
    pressure: { ...pressure, bossActive: boss !== null && !boss.defeated },
  };
}

export function createRunOutcomeNearMissEvidence(
  progress: RunOutcomeProgress,
): RunOutcomeNearMissEvidence {
  if (progress.completionKind === "expeditionCompleted") {
    return { state: "not-applicable", reason: "runCompleted" };
  }
  if (progress.boss === null) {
    return { state: "not-reached", reason: "bossNotReached" };
  }
  return {
    state: "evidence-only",
    reason: "thresholdNotRegistered",
    bossRemainingHp: progress.boss.remainingHp,
    bossMaximumHp: progress.boss.maximumHp,
    bossRemainingHpRatio: progress.boss.remainingHpRatio,
    bossPhaseReached: progress.boss.phaseReached,
  };
}

function createBossProgress(
  events: readonly ObservedGameEvent[],
  completedAt: number,
): RunOutcomeBossProgress | null {
  const spawned = events.find(
    (entry) => entry.elapsed <= completedAt && entry.event.type === "boss.spawned",
  );
  if (!spawned || spawned.event.type !== "boss.spawned") return null;
  let phaseReached: 1 | 2 = 1;
  let remainingHp = spawned.event.maximumHp;
  let defeated = false;
  for (const entry of events) {
    if (entry.elapsed > completedAt) break;
    if (
      entry.event.type === "boss.phase.changed" &&
      entry.event.enemyId === spawned.event.enemyId
    ) {
      phaseReached = 2;
    } else if (
      entry.event.type === "enemy.hit" &&
      entry.event.enemyId === spawned.event.enemyId
    ) {
      remainingHp = Math.max(0, entry.event.hpAfter);
    } else if (
      entry.event.type === "boss.defeated" &&
      entry.event.enemyId === spawned.event.enemyId
    ) {
      remainingHp = 0;
      defeated = true;
    }
  }
  return {
    bossId: spawned.event.bossId,
    enemyId: spawned.event.enemyId,
    phaseReached,
    maximumHp: spawned.event.maximumHp,
    remainingHp,
    remainingHpRatio: spawned.event.maximumHp > 0
      ? remainingHp / spawned.event.maximumHp
      : 0,
    defeated,
  };
}

function createPressureSnapshot(
  events: readonly ObservedGameEvent[],
  completedAt: number,
): RunOutcomeProgress["pressure"] {
  const commanders = new Set<string>();
  const escorts = new Set<string>();
  let collapseStage = 0;
  let lastBossAttackId: BossAttackId | null = null;
  for (const entry of events) {
    if (entry.elapsed > completedAt) break;
    const event = entry.event;
    if (event.type === "elite.commander.spawned") commanders.add(event.enemyId);
    if (event.type === "elite.commander.killed" || event.type === "elite.commander.retired") {
      commanders.delete(event.enemyId);
    }
    if (event.type === "boss.escort.deployed") {
      event.enemyIds.forEach((enemyId) => escorts.add(enemyId));
    }
    if (event.type === "enemy.killed") escorts.delete(event.enemyId);
    if (event.type === "collapse.advanced") collapseStage = Math.max(collapseStage, event.stage);
    if (event.type === "boss.attack.executed") lastBossAttackId = event.attackId;
  }
  return {
    activeCommanderCount: commanders.size,
    activeEscortCount: escorts.size,
    bossActive: false,
    collapseStage,
    lastBossAttackId,
  };
}
