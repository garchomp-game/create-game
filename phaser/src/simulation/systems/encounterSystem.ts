import { ENCOUNTER_IDS } from "../../domain/types";
import type {
  EncounterDefinitionSimulationConfig,
  EncounterId,
  GameEvent,
  RandomSource,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";
import { getThreatTier } from "../threatDirector";

export function updateEncounter(
  world: WorldState,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (config.features.encounterDeck) {
    updateEncounterDirector(world, random, config, events);
  }

  if (
    config.features.endlessContract &&
    world.encounter.director.completedCount > 0 &&
    world.encounter.contract.status === "pending" &&
    world.state.elapsed >= config.encounter.contract.offerAt
  ) {
    world.encounter.contract.status = "offered";
    world.encounter.contract.offeredAt = world.state.elapsed;
    world.state.status = "contractSelect";
    events.push({ type: "contract.offered", elapsed: world.state.elapsed });
  }
}

export function chooseEndlessContract(
  world: WorldState,
  choiceIndex: number,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (world.state.status !== "contractSelect" || world.encounter.contract.status !== "offered") {
    return;
  }
  if (choiceIndex !== 0 && choiceIndex !== 1) return;

  const choice = choiceIndex === 0 ? "standard" : "overdrive";
  const enemySpeedMultiplier =
    choice === "overdrive" ? config.encounter.contract.enemySpeedMultiplier : 1;
  const scoreMultiplier = choice === "overdrive" ? config.encounter.contract.scoreMultiplier : 1;
  world.encounter.contract.status = "selected";
  world.encounter.contract.choice = choice;
  world.encounter.contract.selectedAt = world.state.elapsed;
  world.encounter.contract.enemySpeedMultiplier = enemySpeedMultiplier;
  world.encounter.contract.scoreMultiplier = scoreMultiplier;
  if (choice === "overdrive") {
    for (const enemy of world.enemies) enemy.speed *= enemySpeedMultiplier;
  }
  world.state.status = "playing";
  events.push({
    type: "contract.selected",
    choice,
    elapsed: world.state.elapsed,
    enemySpeedMultiplier,
    scoreMultiplier,
  });
}

export function recordEncounterMovement(
  world: WorldState,
  movement: Vec2,
  config: SimulationConfig,
): void {
  const director = world.encounter.director;
  const scheduledAt = director.scheduledAt;
  const currentId = director.currentId;
  if (scheduledAt === null || currentId === null) return;
  const warningDuration = config.encounter.director.definitions[currentId].warningDuration;
  let window: keyof WorldState["stats"]["encounterMetrics"]["movement"] | null = null;
  if (
    world.state.elapsed >= scheduledAt - warningDuration * 2 &&
    world.state.elapsed < scheduledAt - warningDuration
  ) {
    window = "baseline";
  } else if (director.phase === "warning") {
    window = "warning";
  } else if (director.phase === "active") {
    window = "active";
  } else if (director.phase === "recovery") {
    window = "recovery";
  }
  if (!window) return;

  const metrics = world.stats.encounterMetrics.movement[window];
  metrics.distance += Math.hypot(movement.x, movement.y);
  metrics.vector.x += movement.x;
  metrics.vector.y += movement.y;
}

export function getActiveEncounterDefinition(
  world: WorldState,
  config: SimulationConfig,
): EncounterDefinitionSimulationConfig | null {
  const director = world.encounter.director;
  if (director.phase !== "active" || director.currentId === null) return null;
  return config.encounter.director.definitions[director.currentId];
}

function updateEncounterDirector(
  world: WorldState,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  const director = world.encounter.director;
  if (director.currentId === null || director.scheduledAt === null) {
    scheduleEncounter(
      world,
      drawEncounterId(world, random),
      roundToMillis(
        config.encounter.director.minStart +
          random() *
            (config.encounter.director.maxStart - config.encounter.director.minStart),
      ),
      events,
    );
  }

  const encounterId = director.currentId;
  const scheduledAt = director.scheduledAt;
  if (encounterId === null || scheduledAt === null) return;
  const definition = config.encounter.director.definitions[encounterId];
  const warningAt = scheduledAt - definition.warningDuration;
  const recoveryAt = scheduledAt + definition.activeDuration;
  const completedAt = recoveryAt + definition.recoveryDuration;

  if (director.phase === "pending" && world.state.elapsed >= warningAt) {
    director.phase = "warning";
    director.warningStartedAt = world.state.elapsed;
    events.push({
      type: "encounter.warning.started",
      encounterId,
      elapsed: world.state.elapsed,
    });
  }
  if (director.phase === "warning" && world.state.elapsed >= scheduledAt) {
    director.phase = "active";
    director.activeStartedAt = world.state.elapsed;
    events.push({ type: "encounter.started", encounterId, elapsed: world.state.elapsed });
  }
  if (director.phase === "active" && world.state.elapsed >= recoveryAt) {
    director.phase = "recovery";
    director.recoveryStartedAt = world.state.elapsed;
    events.push({
      type: "encounter.recovery.started",
      encounterId,
      elapsed: world.state.elapsed,
    });
  }
  if (director.phase !== "recovery" || world.state.elapsed < completedAt) return;

  const completionTime = world.state.elapsed;
  director.history.push({
    encounterId,
    scheduledAt,
    warningStartedAt: director.warningStartedAt ?? warningAt,
    activeStartedAt: director.activeStartedAt ?? scheduledAt,
    recoveryStartedAt: director.recoveryStartedAt ?? recoveryAt,
    completedAt: completionTime,
  });
  director.history = director.history.slice(-32);
  director.completedCount += 1;
  events.push({ type: "encounter.completed", encounterId, elapsed: completionTime });

  const nextId = drawEncounterId(world, random);
  const nextDefinition = config.encounter.director.definitions[nextId];
  const contractClearanceAt =
    director.completedCount === 1 && world.encounter.contract.status === "pending"
      ? config.encounter.contract.offerAt + nextDefinition.warningDuration + 8
      : 0;
  const nextAt = roundToMillis(
    Math.max(
      completionTime + getNextEncounterInterval(world, random, config),
      contractClearanceAt,
    ),
  );
  scheduleEncounter(world, nextId, nextAt, events);
}

function scheduleEncounter(
  world: WorldState,
  encounterId: EncounterId,
  scheduledAt: number,
  events: GameEvent[],
): void {
  const director = world.encounter.director;
  director.phase = "pending";
  director.currentId = encounterId;
  director.scheduledAt = scheduledAt;
  director.warningStartedAt = null;
  director.activeStartedAt = null;
  director.recoveryStartedAt = null;
  events.push({ type: "encounter.scheduled", encounterId, scheduledAt });
}

function getNextEncounterInterval(
  world: WorldState,
  random: RandomSource,
  config: SimulationConfig,
): number {
  const director = config.encounter.director;
  const reduction =
    Math.max(0, getThreatTier(config, world.state.elapsed) - 1) *
    director.intervalReductionPerThreatTier;
  const minimum = Math.max(director.minimumInterval, director.minInterval - reduction);
  const maximum = Math.max(minimum, director.maxInterval - reduction);
  return minimum + random() * (maximum - minimum);
}

function drawEncounterId(world: WorldState, random: RandomSource): EncounterId {
  const director = world.encounter.director;
  if (director.bag.length === 0) {
    director.bag = shuffleEncounterIds(random);
    const previous = director.history.at(-1)?.encounterId;
    if (previous && director.bag[0] === previous && director.bag.length > 1) {
      [director.bag[0], director.bag[1]] = [director.bag[1]!, director.bag[0]!];
    }
  }
  return director.bag.shift()!;
}

function shuffleEncounterIds(random: RandomSource): EncounterId[] {
  const result = [...ENCOUNTER_IDS];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function roundToMillis(value: number): number {
  return Math.round(value * 1000) / 1000;
}
