import {
  EX_PROTOCOL_CATALOG,
  getCompatibleExProtocols,
  getExProtocolDefinition,
  toExProtocolEvolutionId,
  toExProtocolId,
} from "../content/exProtocolCatalog";
import type {
  ExProtocolEvolutionId,
  ExProtocolId,
  ExProtocolProgressionState,
  ExProtocolRuntime,
} from "../domain/exProtocols";
import type {
  GameEvent,
  SimulationConfig,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import { setTypedProgressionChoice } from "./progressionChoices";
import {
  applyCapacityIncrease,
  clampPlayerHpToCapacity,
  getPlayerEffectiveMaxHp,
} from "./systems/playerHealthSystem";

export function initializeExProtocolProgression(
  world: WorldState,
  config: SimulationConfig,
  weaponId: WeaponTypeId,
): void {
  if (!config.features.exProtocols) return;
  if (config.exProtocolOfferPolicy !== "fixed-compatible") {
    throw new Error("EX Protocol candidate requires a compatible stage offer policy.");
  }
  world.progression.exProtocol =
    getCompatibleExProtocols(weaponId).length === 3
      ? { status: "unselected", route: null, runtime: null }
      : { status: "unsupported", route: null, runtime: null };
  world.encounter.contract.notBefore = 0;
}

export function offerExProtocolSelection(
  world: WorldState,
  config: SimulationConfig,
  events: GameEvent[],
): boolean {
  const progression = requireExProtocolProgression(world, config);
  if (progression.status === "unsupported") {
    events.push({
      type: "ex.protocol.skipped",
      weaponId: world.state.weaponType,
      reason: "unsupported-weapon",
      elapsed: world.state.elapsed,
    });
    return false;
  }
  if (progression.status !== "unselected") return false;

  const choices = getCompatibleExProtocols(world.state.weaponType).map(
    (protocol) => toExProtocolId(protocol.id),
  );
  if (choices.length !== 3) {
    throw new Error(
      `Expected three EX Protocol choices for "${world.state.weaponType}".`,
    );
  }
  setTypedProgressionChoice(world, { kind: "protocol", choices });
  world.state.status = "protocolSelect";
  events.push({
    type: "ex.protocol.offered",
    weaponId: world.state.weaponType,
    exLevel: 0,
    choices: [...choices],
    elapsed: world.state.elapsed,
  });
  return true;
}

export function chooseExProtocol(
  world: WorldState,
  choiceIndex: number,
  config: SimulationConfig,
  events: GameEvent[],
): boolean {
  if (
    world.state.status !== "protocolSelect" ||
    world.progression.pendingChoice?.kind !== "protocol"
  ) {
    return false;
  }
  const protocolId = world.progression.pendingChoice.choices[choiceIndex];
  if (!protocolId) return false;
  const definition = getExProtocolDefinition(protocolId);
  if (!definition || definition.weaponId !== world.state.weaponType) return false;

  const grossMaxHp = config.player.maxHp + world.runtime.maxHpBonus;
  const route = {
    protocolId,
    selectedAt: world.state.elapsed,
    evolutionOneId: null,
    evolutionOneSelectedAt: null,
    evolutionTwoId: null,
    evolutionTwoSelectedAt: null,
    masteryUnlocked: false,
    masteryUnlockedAt: null,
  };
  world.progression.exProtocol = {
    status: "selected",
    route,
    runtime: createExProtocolRuntime(protocolId, grossMaxHp),
  };
  clampPlayerHpToCapacity(world, config);
  delete world.progression.pendingChoice;
  world.state.status = "playing";
  delayPendingContract(world);
  events.push({
    type: "ex.protocol.selected",
    weaponId: world.state.weaponType,
    protocolId,
    interaction: definition.interaction,
    exLevel: 0,
    elapsed: world.state.elapsed,
  });
  return true;
}

export function offerExProtocolEvolution(
  world: WorldState,
  tier: 1 | 2,
  events: GameEvent[],
): boolean {
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return false;
  const definition = getExProtocolDefinition(progression.route.protocolId);
  if (!definition) throw new Error("Selected EX Protocol is missing from the catalog.");
  const key = tier === 1 ? "evolutionOne" : "evolutionTwo";
  const choices = definition[key].map((option) =>
    toExProtocolEvolutionId(
      progression.route.protocolId,
      key,
      option.id,
    ),
  );
  setTypedProgressionChoice(world, {
    kind: tier === 1 ? "evolution-one" : "evolution-two",
    protocolId: progression.route.protocolId,
    choices,
  });
  world.state.status = "evolutionSelect";
  events.push({
    type: "ex.evolution.offered",
    protocolId: progression.route.protocolId,
    tier,
    exLevel: world.progression.extraLevel,
    choices: [...choices],
    elapsed: world.state.elapsed,
  });
  return true;
}

export function chooseExProtocolEvolution(
  world: WorldState,
  choiceIndex: number,
  config: SimulationConfig,
  events: GameEvent[],
): boolean {
  const pending = world.progression.pendingChoice;
  const progression = world.progression.exProtocol;
  if (
    world.state.status !== "evolutionSelect" ||
    (pending?.kind !== "evolution-one" &&
      pending?.kind !== "evolution-two") ||
    progression?.status !== "selected" ||
    pending.protocolId !== progression.route.protocolId
  ) {
    return false;
  }
  const evolutionId = pending.choices[choiceIndex];
  if (!evolutionId) return false;
  const tier = pending.kind === "evolution-one" ? 1 : 2;
  const effectiveMaxHpBefore = getPlayerEffectiveMaxHp(world, config);
  if (tier === 1) {
    progression.route.evolutionOneId = evolutionId;
    progression.route.evolutionOneSelectedAt = world.state.elapsed;
  } else {
    progression.route.evolutionTwoId = evolutionId;
    progression.route.evolutionTwoSelectedAt = world.state.elapsed;
    progression.route.masteryUnlocked = true;
    progression.route.masteryUnlockedAt = world.state.elapsed;
  }
  applyCapacityIncrease(world, config, effectiveMaxHpBefore, false);
  delete world.progression.pendingChoice;
  world.state.status = "playing";
  delayPendingContract(world);
  events.push({
    type: "ex.evolution.selected",
    protocolId: progression.route.protocolId,
    tier,
    evolutionId,
    exLevel: world.progression.extraLevel,
    elapsed: world.state.elapsed,
  });
  if (tier === 2) {
    const definition = getExProtocolDefinition(progression.route.protocolId);
    if (!definition) throw new Error("Selected EX Protocol is missing from the catalog.");
    events.push({
      type: "ex.mastery.unlocked",
      protocolId: progression.route.protocolId,
      masteryId: definition.mastery.id,
      exLevel: world.progression.extraLevel,
      elapsed: world.state.elapsed,
    });
  }
  return true;
}

export function isExProtocolProgressionSelected(
  progression: ExProtocolProgressionState | undefined,
): progression is Extract<ExProtocolProgressionState, { status: "selected" }> {
  return progression?.status === "selected";
}

export function delayPendingContract(world: WorldState): void {
  if (world.encounter.contract.status !== "pending") return;
  world.encounter.contract.notBefore = Math.max(
    world.encounter.contract.notBefore ?? 0,
    world.state.elapsed + 8,
  );
}

function requireExProtocolProgression(
  world: WorldState,
  config: SimulationConfig,
): ExProtocolProgressionState {
  if (!config.features.exProtocols || !world.progression.exProtocol) {
    throw new Error("EX Protocol progression is not initialized.");
  }
  return world.progression.exProtocol;
}

function createExProtocolRuntime(
  protocolId: ExProtocolId,
  grossMaxHp: number,
): ExProtocolRuntime {
  const [
    resonanceRelay,
    reboundOverdrive,
    redlineCore,
    fullSpanTidalSweep,
    breakwaterFan,
    aegisFan,
  ] = EX_PROTOCOL_CATALOG.protocols;
  if (protocolId === resonanceRelay.id) {
    return {
      kind: "resonance-relay",
      protocolId,
      nextActivationId: 1,
      anchor: null,
    };
  }
  if (protocolId === reboundOverdrive.id) {
    return {
      kind: "rebound-overdrive",
      protocolId,
      armedUntil: null,
      cooldownUntil: 0,
      armedVolleyId: null,
    };
  }
  if (protocolId === redlineCore.id) {
    return { kind: "redline-core", protocolId, grossMaxHpAtSelection: grossMaxHp };
  }
  if (protocolId === fullSpanTidalSweep.id) {
    return {
      kind: "full-span-tidal-sweep",
      protocolId,
      charges: fullSpanTidalSweep.signature.initialCharges,
      nextActivationId: 1,
      activations: {},
    };
  }
  if (protocolId === breakwaterFan.id) {
    return {
      kind: "breakwater-fan",
      protocolId,
      charges: breakwaterFan.signature.initialCharges,
      cooldownUntil: 0,
      grossMaxHpAtSelection: grossMaxHp,
      hpCostAtSelection: Math.ceil(
        grossMaxHp * breakwaterFan.signature.costGrossHpSnapshotRatio,
      ),
    };
  }
  if (protocolId === aegisFan.id) {
    return {
      kind: "aegis-fan",
      protocolId,
      perfectGuardCharges: aegisFan.mastery.initialCharges,
    };
  }
  throw new Error(`Unsupported EX Protocol runtime "${protocolId}".`);
}

export function getSelectedEvolutionIds(world: WorldState): {
  evolutionOneId: ExProtocolEvolutionId | null;
  evolutionTwoId: ExProtocolEvolutionId | null;
} {
  const progression = world.progression.exProtocol;
  return progression?.status === "selected"
    ? {
        evolutionOneId: progression.route.evolutionOneId,
        evolutionTwoId: progression.route.evolutionTwoId,
      }
    : { evolutionOneId: null, evolutionTwoId: null };
}
