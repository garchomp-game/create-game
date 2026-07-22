import {
  DEFAULT_CHARGER_CONTROL_GATE_POLICY,
  type ChargerControlGateObservation,
  type ChargerControlGatePolicy,
  type ChargerControlGateReason,
  type ChargerControlGateResult,
  type ChargerControlReadModel,
  type ChargerControlSample,
} from "../domain/chargerControl";
import type { ChargerEncounterRunStats } from "../domain/types";

export function evaluateChargerControlGate(
  sourceSamples: readonly ChargerControlSample[],
  policy: ChargerControlGatePolicy = DEFAULT_CHARGER_CONTROL_GATE_POLICY,
): ChargerControlGateResult {
  validateGatePolicy(policy);
  const samples = sourceSamples.map((sample) => structuredClone(sample));
  if (samples.some((sample) => sample.observation.state === "invalid")) {
    return createEmptyGateResult("insufficient-data", ["invalid-sample"]);
  }

  const experienced = samples
    .filter((sample) => sample.cohort === "experienced")
    .sort(compareSamples);
  const firstParticipantSamples = collectFirstParticipantSamples(
    experienced,
    policy.firstExperiencedParticipants,
  );
  const firstExperiencedParticipantIds = [...firstParticipantSamples.keys()];
  const participantsWithPreTelegraphKill = [...firstParticipantSamples.values()]
    .filter((participantSamples) => participantSamples.some(hasPreTelegraphKill))
    .length;
  const skilledReached = experienced.filter(
    (sample) => sample.skilledRun && hasChargerOpportunity(sample),
  );
  const skilledRunsWithoutCharge = skilledReached.filter(
    (sample) => sample.observation.state === "available" && sample.observation.charges === 0,
  ).length;
  const resultFacts = {
    experiencedParticipantsObserved: new Set(
      experienced.map((sample) => sample.participantId),
    ).size,
    firstExperiencedParticipantIds,
    participantsWithPreTelegraphKill,
    skilledReachedRuns: skilledReached.length,
    skilledRunsWithoutCharge,
  };

  const stopReasons: ChargerControlGateReason[] = [];
  if (
    firstExperiencedParticipantIds.length >= policy.firstExperiencedParticipants &&
    participantsWithPreTelegraphKill >= policy.preTelegraphStopParticipants
  ) {
    stopReasons.push("pre-telegraph-kills-too-common");
  }

  if (
    skilledReached.length >= policy.minimumSkilledReachedRuns &&
    skilledRunsWithoutCharge / skilledReached.length > policy.noChargeStopRatioExclusive
  ) {
    stopReasons.push("charges-too-rare");
  }
  if (stopReasons.length > 0) {
    return {
      decision: "stop",
      reasons: stopReasons,
      ...resultFacts,
    };
  }

  const pending: ChargerControlGateReason[] = [];
  if (firstExperiencedParticipantIds.length < policy.firstExperiencedParticipants) {
    pending.push("experienced-participants-pending");
  }
  if (skilledReached.length < policy.minimumSkilledReachedRuns) {
    pending.push("skilled-reached-runs-pending");
  }

  return {
    decision: pending.length > 0 ? "insufficient-data" : "pass",
    reasons: pending,
    ...resultFacts,
  };
}

export function createChargerControlGateObservation(
  readModel: ChargerControlReadModel,
): ChargerControlGateObservation {
  if (readModel.validation.state === "invalid" || readModel.summary === null) {
    return { state: "invalid" };
  }
  return {
    state: "available",
    spawned: readModel.summary.spawned,
    charges: readModel.summary.charges,
    killedBeforeTelegraph: readModel.summary.killedBeforeTelegraph,
  };
}

export function createChargerControlGateObservationFromStats(
  stats: ChargerEncounterRunStats | null | undefined,
): ChargerControlGateObservation {
  return {
    state: "available",
    spawned: stats?.spawned ?? 0,
    charges: stats?.charges ?? 0,
    killedBeforeTelegraph: stats?.killedBeforeTelegraph ?? 0,
  };
}

function collectFirstParticipantSamples(
  experienced: readonly ChargerControlSample[],
  limit: number,
): Map<string, ChargerControlSample[]> {
  const result = new Map<string, ChargerControlSample[]>();
  for (const sample of experienced) {
    if (!result.has(sample.participantId)) {
      if (result.size >= limit) continue;
      result.set(sample.participantId, []);
    }
    result.get(sample.participantId)?.push(sample);
  }
  return result;
}

function hasPreTelegraphKill(sample: ChargerControlSample): boolean {
  return sample.observation.state === "available" &&
    sample.observation.killedBeforeTelegraph > 0;
}

function hasChargerOpportunity(sample: ChargerControlSample): boolean {
  return sample.observation.state === "available" && sample.observation.spawned > 0;
}

function compareSamples(left: ChargerControlSample, right: ChargerControlSample): number {
  return left.participantOrder - right.participantOrder ||
    left.runOrder - right.runOrder ||
    left.participantId.localeCompare(right.participantId) ||
    left.runId.localeCompare(right.runId);
}

function validateGatePolicy(policy: ChargerControlGatePolicy): void {
  if (
    !Number.isInteger(policy.firstExperiencedParticipants) ||
    policy.firstExperiencedParticipants <= 0 ||
    !Number.isInteger(policy.preTelegraphStopParticipants) ||
    policy.preTelegraphStopParticipants <= 0 ||
    policy.preTelegraphStopParticipants > policy.firstExperiencedParticipants ||
    !Number.isInteger(policy.minimumSkilledReachedRuns) ||
    policy.minimumSkilledReachedRuns <= 0 ||
    !Number.isFinite(policy.noChargeStopRatioExclusive) ||
    policy.noChargeStopRatioExclusive < 0 ||
    policy.noChargeStopRatioExclusive >= 1
  ) {
    throw new Error("Invalid Charger control gate policy.");
  }
}

function createEmptyGateResult(
  decision: ChargerControlGateResult["decision"],
  reasons: ChargerControlGateReason[],
): ChargerControlGateResult {
  return {
    decision,
    reasons,
    experiencedParticipantsObserved: 0,
    firstExperiencedParticipantIds: [],
    participantsWithPreTelegraphKill: 0,
    skilledReachedRuns: 0,
    skilledRunsWithoutCharge: 0,
  };
}
