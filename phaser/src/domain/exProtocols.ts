declare const exProtocolIdBrand: unique symbol;
declare const exProtocolEvolutionIdBrand: unique symbol;

export type ExProtocolId = string & {
  readonly [exProtocolIdBrand]: "ExProtocolId";
};

export type ExProtocolEvolutionId = string & {
  readonly [exProtocolEvolutionIdBrand]: "ExProtocolEvolutionId";
};

export type ExProtocolRoute = {
  protocolId: ExProtocolId;
  selectedAt: number;
  evolutionOneId: ExProtocolEvolutionId | null;
  evolutionOneSelectedAt: number | null;
  evolutionTwoId: ExProtocolEvolutionId | null;
  evolutionTwoSelectedAt: number | null;
  masteryUnlocked: boolean;
  masteryUnlockedAt: number | null;
};

type ExProtocolRuntimeBase = {
  protocolId: ExProtocolId;
};

export type ResonanceRelayRuntime = ExProtocolRuntimeBase & {
  kind: "resonance-relay";
  anchor: {
    enemyId: string;
    expiresAt: number;
    createdByVolleyId: number;
  } | null;
};

export type ReboundOverdriveRuntime = ExProtocolRuntimeBase & {
  kind: "rebound-overdrive";
  armedUntil: number | null;
  cooldownUntil: number;
  armedVolleyId: number | null;
};

export type RedlineCoreRuntime = ExProtocolRuntimeBase & {
  kind: "redline-core";
  grossMaxHpAtSelection: number;
};

export type FullSpanTidalSweepRuntime = ExProtocolRuntimeBase & {
  kind: "full-span-tidal-sweep";
  charges: number;
  nextActivationId: number;
};

export type BreakwaterFanRuntime = ExProtocolRuntimeBase & {
  kind: "breakwater-fan";
  charges: number;
  cooldownUntil: number;
  grossMaxHpAtSelection: number;
  hpCostAtSelection: number;
};

export type AegisFanRuntime = ExProtocolRuntimeBase & {
  kind: "aegis-fan";
  perfectGuardCharges: number;
};

export type ExProtocolRuntime =
  | ResonanceRelayRuntime
  | ReboundOverdriveRuntime
  | RedlineCoreRuntime
  | FullSpanTidalSweepRuntime
  | BreakwaterFanRuntime
  | AegisFanRuntime;

export type ExProtocolProgressionState =
  | {
      status: "unselected";
      route: null;
      runtime: null;
    }
  | {
      status: "selected";
      route: ExProtocolRoute;
      runtime: ExProtocolRuntime;
    }
  | {
      status: "unsupported";
      route: null;
      runtime: null;
    };
