import {
  BOSS_ATTACK_IDS,
  type BossAttackId,
} from "../domain/types";
import {
  BOSS_CENTRAL_ORBIT_RADIUS,
  BOSS_SHADOW_SCHEMA_VERSION,
  type BossAttackShadowEpisode,
  type BossAttackShadowSummary,
  type BossShadowReport,
  type BossShadowTimeBin,
  type BossWarningResponse,
} from "../domain/bossShadow";

export type BossShadowEpisodeInput = Omit<
  BossAttackShadowEpisode,
  "warningResponse" | "punishWindowCompleted" | "punishConverted"
>;

export type BossShadowTimeBinInput = Omit<BossShadowTimeBin, "repairOffsetRate">;

export type CreateBossShadowReportInput = {
  boss: {
    bossId: string;
    enemyId: string;
    spawnedAt: number;
    defeatedAt: number | null;
  } | null;
  observedUntil: number;
  playerDamage: number;
  hpRecovered: number;
  healPickupsCollected: number;
  healPickupsCollectedAtFullHp: number;
  regularEnemiesKilled: number;
  sampledSeconds: number;
  centralOrbitSeconds: number;
  episodes: readonly BossShadowEpisodeInput[];
  bins: readonly BossShadowTimeBinInput[];
};

export function createBossShadowReport(
  input: CreateBossShadowReportInput,
): BossShadowReport {
  const boss = input.boss;
  if (!boss) return createEmptyBossShadowReport();
  const observedUntil = finiteNonNegative(input.observedUntil);
  const episodes = input.episodes.map((episode) =>
    finalizeEpisode(episode, observedUntil)
  );
  return {
    schemaVersion: BOSS_SHADOW_SCHEMA_VERSION,
    state: "available",
    bossId: boss.bossId,
    enemyId: boss.enemyId,
    spawnedAt: boss.spawnedAt,
    observedUntil,
    defeatedAt: boss.defeatedAt,
    playerDamage: input.playerDamage,
    hpRecovered: input.hpRecovered,
    repairOffsetRate: ratio(input.hpRecovered, input.playerDamage),
    healPickupsCollected: input.healPickupsCollected,
    healPickupsCollectedAtFullHp: input.healPickupsCollectedAtFullHp,
    regularEnemiesKilled: input.regularEnemiesKilled,
    centralOrbit: {
      radius: BOSS_CENTRAL_ORBIT_RADIUS,
      sampledSeconds: input.sampledSeconds,
      secondsWithinRadius: input.centralOrbitSeconds,
      share: ratio(input.centralOrbitSeconds, input.sampledSeconds),
    },
    attacks: Object.fromEntries(
      BOSS_ATTACK_IDS.map((attackId) => [
        attackId,
        summarizeAttack(episodes, attackId),
      ]),
    ) as Record<BossAttackId, BossAttackShadowSummary>,
    episodes,
    tenSecondBins: [...input.bins]
      .sort((left, right) => left.index - right.index)
      .map((bin) => ({
        ...bin,
        repairOffsetRate: ratio(bin.hpRecovered, bin.playerDamage),
      })),
  };
}

export function createEmptyBossShadowReport(): BossShadowReport {
  return {
    schemaVersion: BOSS_SHADOW_SCHEMA_VERSION,
    state: "not-reached",
    reason: "bossNotSpawned",
  };
}

function finalizeEpisode(
  episode: BossShadowEpisodeInput,
  observedUntil: number,
): BossAttackShadowEpisode {
  return {
    ...episode,
    warningResponse: resolveWarningResponse(episode, observedUntil),
    punishWindowCompleted:
      episode.recoveryEndsAt !== null &&
      (observedUntil >= episode.recoveryEndsAt || episode.bossDamageDuringRecovery > 0),
    punishConverted: episode.bossDamageDuringRecovery > 0,
  };
}

function resolveWarningResponse(
  episode: BossShadowEpisodeInput,
  observedUntil: number,
): BossWarningResponse {
  if (episode.executedAt === null) return "incomplete";
  if (episode.attackId === "command-pulse") {
    if (episode.commandPulseResult === "hit") return "hit";
    if (
      episode.commandPulseResult === "blocked" ||
      episode.commandPulseResult === "outside"
    ) return "handled";
    if (episode.commandPulseResult === "invulnerable") return "excluded";
    return "incomplete";
  }
  if (episode.responseEndsAt === null || observedUntil < episode.responseEndsAt) {
    return "incomplete";
  }
  return episode.playerDamage > 0 ? "hit" : "handled";
}

function summarizeAttack(
  episodes: readonly BossAttackShadowEpisode[],
  attackId: BossAttackId,
): BossAttackShadowSummary {
  const selected = episodes.filter((episode) => episode.attackId === attackId);
  const eligible = selected.filter((episode) =>
    episode.warningResponse === "handled" || episode.warningResponse === "hit"
  );
  const first = eligible.filter((episode) => episode.exposureIndex === 1);
  const repeat = eligible.filter((episode) => episode.exposureIndex > 1);
  const punishEligible = selected.filter((episode) => episode.punishWindowCompleted);
  const punishConverted = punishEligible.filter((episode) => episode.punishConverted);
  const handled = eligible.filter((episode) => episode.warningResponse === "handled");
  return {
    telegraphed: selected.length,
    responseEligible: eligible.length,
    responsesHandled: handled.length,
    warningResponseRate: ratio(handled.length, eligible.length),
    firstExposure: summarizeExposure(first),
    repeatExposure: summarizeExposure(repeat),
    punishEligible: punishEligible.length,
    punishConverted: punishConverted.length,
    punishConversionRate: ratio(punishConverted.length, punishEligible.length),
    bossDamageDuringRecovery: selected.reduce(
      (total, episode) => total + episode.bossDamageDuringRecovery,
      0,
    ),
  };
}

function summarizeExposure(episodes: readonly BossAttackShadowEpisode[]) {
  return {
    eligible: episodes.length,
    handled: episodes.filter((episode) => episode.warningResponse === "handled").length,
    playerHits: episodes.reduce((total, episode) => total + episode.playerHits, 0),
    playerDamage: episodes.reduce((total, episode) => total + episode.playerDamage, 0),
  };
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
