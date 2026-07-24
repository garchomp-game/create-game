import type { ObservedGameEvent } from "./runFacts";
import type { ChargerActionState, WeaponTypeId } from "./types";

export const CHARGER_CONTROL_READ_MODEL_VERSION = 1 as const;

export type ChargerControlValidationIssue =
  | { code: "invalidSequence"; inputIndex: number }
  | { code: "duplicateSequence"; sequence: number }
  | { code: "invalidElapsed"; inputIndex: number }
  | { code: "duplicateSpawn"; enemyId: string; sequence: number }
  | {
      code: "eventBeforeSpawn";
      enemyId: string;
      eventType: string;
      sequence: number;
    }
  | {
      code: "eventAfterKill";
      enemyId: string;
      eventType: string;
      sequence: number;
    }
  | { code: "chargeBeforeTelegraph"; enemyId: string; sequence: number }
  | { code: "chargeEndBeforeCharge"; enemyId: string; sequence: number }
  | { code: "recoveryBeforeChargeEnd"; enemyId: string; sequence: number }
  | {
      code: "killChargeCountMismatch";
      enemyId: string;
      sequence: number;
      observed: number;
      aggregated: number;
    }
  | { code: "duplicateKill"; enemyId: string; sequence: number };

export type ChargerControlKill = {
  elapsed: number;
  sequence: number;
  phase: ChargerActionState["phase"];
  weaponId: WeaponTypeId;
};

export type ChargerControlAttempt = {
  enemyId: string;
  spawnedAt: number;
  spawnSequence: number;
  firstTelegraphAt: number | null;
  telegraphs: number;
  charges: number;
  chargeEnds: number;
  timeoutEnds: number;
  obstacleInterruptions: number;
  boundaryInterruptions: number;
  recoveries: number;
  playerHits: number;
  killedBeforeTelegraph: boolean;
  kill: ChargerControlKill | null;
};

export type ChargerControlSummary = {
  opportunityState: "observed" | "not-reached";
  spawned: number;
  killed: number;
  killedBeforeTelegraph: number;
  enemiesTelegraphed: number;
  telegraphs: number;
  enemiesCharged: number;
  charges: number;
  chargeEnds: number;
  timeoutEnds: number;
  obstacleInterruptions: number;
  boundaryInterruptions: number;
  recoveries: number;
  playerHits: number;
};

export type ChargerControlReadModel = {
  schemaVersion: typeof CHARGER_CONTROL_READ_MODEL_VERSION;
  validation:
    | { state: "available" }
    | { state: "invalid"; issues: ChargerControlValidationIssue[] };
  observedEventCount: number;
  chargerEventCount: number;
  attempts: ChargerControlAttempt[];
  summary: ChargerControlSummary | null;
};

export type ChargerControlSample = {
  participantId: string;
  participantOrder: number;
  runId: string;
  runOrder: number;
  cohort: "novice" | "experienced";
  skilledRun: boolean;
  observation: ChargerControlGateObservation;
};

export type ChargerControlGateObservation =
  | {
      state: "available";
      spawned: number;
      charges: number;
      killedBeforeTelegraph: number;
    }
  | { state: "invalid" };

export type ChargerControlGatePolicy = {
  firstExperiencedParticipants: number;
  preTelegraphStopParticipants: number;
  minimumSkilledReachedRuns: number;
  noChargeStopRatioExclusive: number;
};

export const DEFAULT_CHARGER_CONTROL_GATE_POLICY: ChargerControlGatePolicy = {
  firstExperiencedParticipants: 3,
  preTelegraphStopParticipants: 2,
  minimumSkilledReachedRuns: 3,
  noChargeStopRatioExclusive: 0.5,
};

export type ChargerControlGateReason =
  | "invalid-sample"
  | "experienced-participants-pending"
  | "skilled-reached-runs-pending"
  | "pre-telegraph-kills-too-common"
  | "charges-too-rare";

export type ChargerControlGateResult = {
  decision: "pass" | "stop" | "insufficient-data";
  reasons: ChargerControlGateReason[];
  experiencedParticipantsObserved: number;
  firstExperiencedParticipantIds: string[];
  participantsWithPreTelegraphKill: number;
  skilledReachedRuns: number;
  skilledRunsWithoutCharge: number;
};

export type ChargerObservedEvent = ObservedGameEvent & {
  event: Extract<
    ObservedGameEvent["event"],
    { type: `enemy.charger.${string}` }
  >;
};
