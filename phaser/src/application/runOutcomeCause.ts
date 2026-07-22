import type { RunDamageFact } from "../domain/runFacts";
import {
  RUN_OUTCOME_DAMAGE_WINDOW_SECONDS,
  type RunOutcomeCauseKind,
  type RunOutcomeNextAction,
  type RunOutcomePrimaryCause,
  type RunOutcomeProgress,
} from "../domain/runOutcomeInsights";
import type {
  BossAttackId,
  EnemyTypeId,
  PlayerDamageSource,
} from "../domain/types";

type CauseContribution = {
  causeId: string;
  kind: RunOutcomeCauseKind;
  bossAttackId: BossAttackId | null;
  enemyType: EnemyTypeId | null;
  damage: number;
  hits: number;
  lastElapsed: number;
  lastSequence: number;
};

export function createRunOutcomePrimaryCause(
  damageTimeline: readonly RunDamageFact[],
  completedAt: number,
): RunOutcomePrimaryCause | null {
  const windowStart = Math.max(0, completedAt - RUN_OUTCOME_DAMAGE_WINDOW_SECONDS);
  const recent = damageTimeline.filter(
    (fact) => fact.elapsed >= windowStart && fact.elapsed <= completedAt,
  );
  if (recent.length === 0) return null;

  const contributions = new Map<string, CauseContribution>();
  for (const fact of recent) {
    const descriptor = describeSource(fact.source);
    const contribution = contributions.get(descriptor.causeId) ?? {
      ...descriptor,
      damage: 0,
      hits: 0,
      lastElapsed: fact.elapsed,
      lastSequence: fact.sequence,
    };
    contribution.damage += fact.damage;
    contribution.hits += 1;
    if (
      fact.elapsed > contribution.lastElapsed ||
      (fact.elapsed === contribution.lastElapsed && fact.sequence > contribution.lastSequence)
    ) {
      contribution.lastElapsed = fact.elapsed;
      contribution.lastSequence = fact.sequence;
    }
    contributions.set(descriptor.causeId, contribution);
  }

  const selected = [...contributions.values()].sort(
    (left, right) =>
      right.damage - left.damage ||
      right.lastElapsed - left.lastElapsed ||
      right.lastSequence - left.lastSequence ||
      left.causeId.localeCompare(right.causeId),
  )[0]!;
  const finalHit = recent.reduce((latest, fact) =>
    fact.elapsed > latest.elapsed ||
    (fact.elapsed === latest.elapsed && fact.sequence > latest.sequence)
      ? fact
      : latest
  );

  return {
    causeId: selected.causeId,
    kind: selected.kind,
    title: formatCauseTitle(selected),
    evidence: `終了前${RUN_OUTCOME_DAMAGE_WINDOW_SECONDS}秒に${selected.damage}ダメージ（${selected.hits}回）`,
    damage: selected.damage,
    hits: selected.hits,
    lastElapsed: selected.lastElapsed,
    isFinalHit: selected.causeId === describeSource(finalHit.source).causeId,
    bossAttackId: selected.bossAttackId,
    enemyType: selected.enemyType,
  };
}

export function createRunOutcomeNextAction(
  cause: RunOutcomePrimaryCause | null,
  pressure: RunOutcomeProgress["pressure"],
): RunOutcomeNextAction {
  if (cause?.bossAttackId === "targeted-salvo") {
    return { id: "leave-attack-line", title: "予告線を見たら照準を切って射線から外れる" };
  }
  if (cause?.bossAttackId === "command-pulse") {
    return {
      id: "use-cover-or-exit-radius",
      title: "衝撃波は障害物か範囲外で処理する",
    };
  }
  if (cause?.kind === "collapse") {
    return { id: "return-to-safe-zone", title: "崩壊前に安全領域へ戻る" };
  }
  if (cause?.bossAttackId === "escort-pincer" || pressure.activeEscortCount > 0) {
    return { id: "prioritize-escorts", title: "護衛を先に減らして退路を作る" };
  }
  if (pressure.activeCommanderCount > 0) {
    return { id: "prioritize-commander", title: "指揮個体を優先して増援圧力を止める" };
  }
  if (cause?.kind === "contact") {
    return { id: "preserve-escape-route", title: "敵群へ入る前に退路を一方向残す" };
  }
  if (cause?.kind === "projectile") {
    return { id: "change-projectile-line", title: "敵弾と平行に走らず射線を横切って外す" };
  }
  return { id: "review-final-pressure", title: "終了前5秒の位置と優先標的を見直す" };
}

function describeSource(
  source: PlayerDamageSource | null,
): Pick<CauseContribution, "causeId" | "kind" | "bossAttackId" | "enemyType"> {
  if (source?.kind === "collapse") {
    return { causeId: "collapse", kind: "collapse", bossAttackId: null, enemyType: null };
  }
  if (source?.kind === "projectile" && source.bossAttackId) {
    return {
      causeId: `boss:${source.bossAttackId}`,
      kind: "bossAttack",
      bossAttackId: source.bossAttackId,
      enemyType: null,
    };
  }
  if (source?.kind === "contact" && source.bossAttackId) {
    return {
      causeId: `boss:${source.bossAttackId}`,
      kind: "bossAttack",
      bossAttackId: source.bossAttackId,
      enemyType: source.enemyType,
    };
  }
  if (source?.kind === "contact") {
    return {
      causeId: `contact:${source.enemyType}`,
      kind: "contact",
      bossAttackId: null,
      enemyType: source.enemyType,
    };
  }
  if (source?.kind === "projectile") {
    return { causeId: "projectile", kind: "projectile", bossAttackId: null, enemyType: null };
  }
  return { causeId: "unknown", kind: "unknown", bossAttackId: null, enemyType: null };
}

function formatCauseTitle(cause: CauseContribution): string {
  if (cause.bossAttackId === "targeted-salvo") return "指揮艦の照準斉射";
  if (cause.bossAttackId === "escort-pincer") return "指揮艦の挟撃護衛";
  if (cause.bossAttackId === "command-pulse") return "指揮艦の制圧衝撃波";
  if (cause.kind === "collapse") return "アリーナ崩壊";
  if (cause.kind === "projectile") return "敵弾の集中被弾";
  if (cause.kind === "contact") return `${formatEnemyType(cause.enemyType)}との接触`;
  return "複合した終盤圧力";
}

function formatEnemyType(enemyType: EnemyTypeId | null): string {
  if (enemyType === "fast") return "高速敵";
  if (enemyType === "brute") return "大型敵";
  if (enemyType === "ranged") return "射撃敵";
  if (enemyType === "chaser") return "追跡敵";
  return "敵";
}
