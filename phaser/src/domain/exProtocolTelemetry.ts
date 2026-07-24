import type {
  ExProtocolEvolutionId,
  ExProtocolId,
} from "./exProtocols";

export const EX_SPECIAL_REJECT_REASONS = [
  "already-armed",
  "cooldown",
  "not-charged",
  "insufficient-hp",
] as const;

export type ExSpecialRejectReason =
  (typeof EX_SPECIAL_REJECT_REASONS)[number];

export const EX_PROTOCOL_COMMON_COUNTER_KEYS = [
  "protocolExposureSeconds",
  "evolutionOneExposureSeconds",
  "evolutionTwoExposureSeconds",
  "masteryExposureSeconds",
  "choiceCountProtocol",
  "choiceCountEvolution",
] as const;

export const EX_PROTOCOL_COUNTER_KEYS = {
  "pulse.resonance-relay": [
    "anchorsCreated",
    "relayAttempts",
    "relayResolved",
    "relayBlocked",
    "relayTargets",
    "relayDamage",
    "focusStacksConsumed",
  ],
  "pulse.rebound-overdrive": [
    "arms",
    "armedVolleys",
    "armExpired",
    "ricochetsRestored",
    "restoredCapacity",
    "restoredCapacityHitDamage",
    "returnSurgeBonusDamage",
    "postRicochetUniqueHits",
    "masteryRefunds",
  ],
  "pulse.redline-core": [
    "hpReservedPeak",
    "redlineHits",
    "redlineBonusDamage",
    "capacityRestored",
    "masteryHits",
    "masterySourceDamage",
  ],
  "spread.full-span-tidal-sweep": [
    "chargeEvents",
    "activations",
    "activationTargets",
    "tidalDamage",
    "backwashTriggers",
    "secondCrestTriggers",
    "chargeAtRunEnd",
  ],
  "spread.breakwater-fan": [
    "chargeEvents",
    "activations",
    "insufficientHpRejects",
    "hpSpent",
    "affectedTargets",
    "pushedTargets",
    "breakwaterDamage",
    "escapeCurrentTriggers",
  ],
  "spread.aegis-fan": [
    "edgeShots",
    "intercepts",
    "interceptedWithPlannedPlayerEndpointContact",
    "leftInterceptions",
    "rightInterceptions",
    "perfectGuardCharges",
    "empoweredVolleys",
    "perfectGuardBonusDamage",
  ],
} as const;

export type ExProtocolCounterKey =
  | (typeof EX_PROTOCOL_COMMON_COUNTER_KEYS)[number]
  | (typeof EX_PROTOCOL_COUNTER_KEYS)[keyof typeof EX_PROTOCOL_COUNTER_KEYS][number];

export type ExProtocolRunStats = {
  offeredIds: ExProtocolId[];
  selectedId: ExProtocolId | null;
  selectedAtElapsed: number | null;
  evolutionOneId: ExProtocolEvolutionId | null;
  evolutionOneAtElapsed: number | null;
  evolutionTwoId: ExProtocolEvolutionId | null;
  evolutionTwoAtElapsed: number | null;
  masteryId: string | null;
  masteryAtElapsed: number | null;
  limitBreakFirstAtElapsed: number | null;
  totalPlayerDamage: number;
  protocolSourceDamage: number;
  protocolBonusDamageAttributed: number;
  protocolSourceKills: number;
  protocolBonusFinisherKills: number;
  specialPresses: number;
  specialAccepted: number;
  specialRejectedByReason: Partial<Record<ExSpecialRejectReason, number>>;
  activeUseIntervalCount: number;
  activeUseIntervalSumSeconds: number;
  activeUseIntervalMaxSeconds: number;
  lastAcceptedSpecialAtElapsed: number | null;
  counters: Record<string, number>;
};

const ALLOWED_COMMON_COUNTER_KEYS = new Set<string>(
  EX_PROTOCOL_COMMON_COUNTER_KEYS,
);

export function createEmptyExProtocolRunStats(): ExProtocolRunStats {
  return {
    offeredIds: [],
    selectedId: null,
    selectedAtElapsed: null,
    evolutionOneId: null,
    evolutionOneAtElapsed: null,
    evolutionTwoId: null,
    evolutionTwoAtElapsed: null,
    masteryId: null,
    masteryAtElapsed: null,
    limitBreakFirstAtElapsed: null,
    totalPlayerDamage: 0,
    protocolSourceDamage: 0,
    protocolBonusDamageAttributed: 0,
    protocolSourceKills: 0,
    protocolBonusFinisherKills: 0,
    specialPresses: 0,
    specialAccepted: 0,
    specialRejectedByReason: {},
    activeUseIntervalCount: 0,
    activeUseIntervalSumSeconds: 0,
    activeUseIntervalMaxSeconds: 0,
    lastAcceptedSpecialAtElapsed: null,
    counters: {},
  };
}

export function incrementExProtocolCounter(
  stats: ExProtocolRunStats,
  key: ExProtocolCounterKey,
  amount = 1,
): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid EX Protocol counter increment for "${key}".`);
  }
  if (!isAllowedCounter(stats.selectedId, key)) return;
  stats.counters[key] = (stats.counters[key] ?? 0) + amount;
}

export function setExProtocolCounter(
  stats: ExProtocolRunStats,
  key: ExProtocolCounterKey,
  value: number,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid EX Protocol counter value for "${key}".`);
  }
  if (!isAllowedCounter(stats.selectedId, key)) return;
  stats.counters[key] = value;
}

export function sanitizeExProtocolCounters(
  selectedId: ExProtocolId | null,
  counters: Readonly<Record<string, number>>,
): Record<string, number> {
  const sanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(counters)) {
    if (
      isAllowedCounter(selectedId, key) &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function isAllowedCounter(
  selectedId: ExProtocolId | null,
  key: string,
): key is ExProtocolCounterKey {
  if (ALLOWED_COMMON_COUNTER_KEYS.has(key)) return true;
  if (!selectedId) return false;
  const protocolKeys =
    EX_PROTOCOL_COUNTER_KEYS[
      selectedId as keyof typeof EX_PROTOCOL_COUNTER_KEYS
    ];
  return (protocolKeys as readonly string[] | undefined)?.includes(key) ?? false;
}
