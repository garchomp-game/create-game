import type {
  BossAttackId,
  BossCommandPulseResult,
} from "./types";

export const BOSS_SHADOW_SCHEMA_VERSION = 1 as const;
export const BOSS_SHADOW_BIN_SECONDS = 10 as const;
export const BOSS_CENTRAL_ORBIT_RADIUS = 220 as const;

export type BossWarningResponse =
  | "handled"
  | "hit"
  | "excluded"
  | "incomplete";

export type BossAttackShadowEpisode = {
  episodeId: string;
  bossId: string;
  enemyId: string;
  attackId: BossAttackId;
  phase: 1 | 2;
  exposureIndex: number;
  telegraphedAt: number;
  executedAt: number | null;
  recoveryStartedAt: number | null;
  recoveryEndsAt: number | null;
  responseEndsAt: number | null;
  commandPulseResult: BossCommandPulseResult | null;
  warningResponse: BossWarningResponse;
  playerHits: number;
  playerDamage: number;
  bossDamageDuringRecovery: number;
  playerBossDistanceAtRecoveryStart: number | null;
  playerBossDistanceAtRecoveryEnd: number | null;
  punishWindowCompleted: boolean;
  punishConverted: boolean;
};

export type BossAttackShadowSummary = {
  telegraphed: number;
  responseEligible: number;
  responsesHandled: number;
  warningResponseRate: number | null;
  firstExposure: {
    eligible: number;
    handled: number;
    playerHits: number;
    playerDamage: number;
  };
  repeatExposure: {
    eligible: number;
    handled: number;
    playerHits: number;
    playerDamage: number;
  };
  punishEligible: number;
  punishConverted: number;
  punishConversionRate: number | null;
  bossDamageDuringRecovery: number;
};

export type BossShadowTimeBin = {
  index: number;
  startsAtBossSeconds: number;
  endsAtBossSeconds: number;
  playerDamage: number;
  hpRecovered: number;
  repairOffsetRate: number | null;
  healPickupsCollected: number;
  healPickupsCollectedAtFullHp: number;
  regularEnemiesKilled: number;
};

export type BossShadowReport =
  | {
      schemaVersion: typeof BOSS_SHADOW_SCHEMA_VERSION;
      state: "not-reached";
      reason: "bossNotSpawned";
    }
  | {
      schemaVersion: typeof BOSS_SHADOW_SCHEMA_VERSION;
      state: "available";
      bossId: string;
      enemyId: string;
      spawnedAt: number;
      observedUntil: number;
      defeatedAt: number | null;
      playerDamage: number;
      hpRecovered: number;
      repairOffsetRate: number | null;
      healPickupsCollected: number;
      healPickupsCollectedAtFullHp: number;
      regularEnemiesKilled: number;
      centralOrbit: {
        radius: typeof BOSS_CENTRAL_ORBIT_RADIUS;
        sampledSeconds: number;
        secondsWithinRadius: number;
        share: number | null;
      };
      attacks: Record<BossAttackId, BossAttackShadowSummary>;
      episodes: BossAttackShadowEpisode[];
      tenSecondBins: BossShadowTimeBin[];
    };
