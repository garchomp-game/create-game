import type {
  ExtraUpgradeId,
  ProgressionPendingChoice,
  SimulationConfig,
  UpgradeId,
  WorldState,
} from "../domain/types";

export function setUpgradeChoices(
  world: WorldState,
  choices: UpgradeId[],
  config: SimulationConfig,
): void {
  world.progression.pendingUpgradeChoices = [...choices];
  setTypedChoice(world, { kind: "upgrade", choices: [...choices] }, config);
}

export function setLimitBreakChoices(
  world: WorldState,
  choices: ExtraUpgradeId[],
  config: SimulationConfig,
): void {
  world.progression.pendingUpgradeChoices = [...choices];
  setTypedChoice(
    world,
    { kind: "limit-break", choices: [...choices] },
    config,
  );
}

export function setTypedProgressionChoice(
  world: WorldState,
  choice: ProgressionPendingChoice,
): void {
  world.progression.pendingUpgradeChoices = [];
  world.progression.pendingChoice = choice;
}

export function clearProgressionChoice(
  world: WorldState,
  config: SimulationConfig,
): void {
  world.progression.pendingUpgradeChoices = [];
  if (config.features.exProtocols) {
    delete world.progression.pendingChoice;
  }
}

export function getPendingUpgradeChoices(
  world: WorldState,
): UpgradeId[] {
  if (world.progression.pendingChoice?.kind === "upgrade") {
    return world.progression.pendingChoice.choices;
  }
  return world.progression.pendingUpgradeChoices.filter(
    (choice): choice is UpgradeId =>
      !choice.startsWith("limit"),
  );
}

export function getPendingLimitBreakChoices(
  world: WorldState,
): ExtraUpgradeId[] {
  if (world.progression.pendingChoice?.kind === "limit-break") {
    return world.progression.pendingChoice.choices;
  }
  return world.progression.pendingUpgradeChoices.filter(
    (choice): choice is ExtraUpgradeId =>
      choice.startsWith("limit"),
  );
}

function setTypedChoice(
  world: WorldState,
  choice: ProgressionPendingChoice,
  config: SimulationConfig,
): void {
  if (config.features.exProtocols) {
    world.progression.pendingChoice = choice;
  }
}
