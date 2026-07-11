import type {
  GameEvent,
  RandomSource,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../../domain/types";

export function updateEncounter(
  world: WorldState,
  random: RandomSource,
  config: SimulationConfig,
  events: GameEvent[],
): void {
  if (!config.features.rangedSurge) return;

  const surge = world.encounter.rangedSurge;
  const definition = config.encounter.rangedSurge;
  if (surge.scheduledAt === null) {
    surge.scheduledAt = roundToMillis(
      definition.minStart + random() * (definition.maxStart - definition.minStart),
    );
    events.push({
      type: "encounter.scheduled",
      encounterId: "rangedSurge",
      scheduledAt: surge.scheduledAt,
    });
  }

  const warningAt = surge.scheduledAt - definition.warningDuration;
  const recoveryAt = surge.scheduledAt + definition.activeDuration;
  const completedAt = recoveryAt + definition.recoveryDuration;

  if (surge.phase === "pending" && world.state.elapsed >= warningAt) {
    surge.phase = "warning";
    surge.warningStartedAt = world.state.elapsed;
    events.push({
      type: "encounter.warning.started",
      encounterId: "rangedSurge",
      elapsed: world.state.elapsed,
    });
  }
  if (surge.phase === "warning" && world.state.elapsed >= surge.scheduledAt) {
    surge.phase = "active";
    surge.activeStartedAt = world.state.elapsed;
    events.push({
      type: "encounter.started",
      encounterId: "rangedSurge",
      elapsed: world.state.elapsed,
    });
  }
  if (surge.phase === "active" && world.state.elapsed >= recoveryAt) {
    surge.phase = "recovery";
    surge.recoveryStartedAt = world.state.elapsed;
    events.push({
      type: "encounter.recovery.started",
      encounterId: "rangedSurge",
      elapsed: world.state.elapsed,
    });
  }
  if (surge.phase === "recovery" && world.state.elapsed >= completedAt) {
    surge.phase = "completed";
    surge.completedAt = world.state.elapsed;
    events.push({
      type: "encounter.completed",
      encounterId: "rangedSurge",
      elapsed: world.state.elapsed,
    });
  }

  if (
    surge.phase === "completed" &&
    config.features.endlessContract &&
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
  const scheduledAt = world.encounter.rangedSurge.scheduledAt;
  if (scheduledAt === null) return;
  const warningDuration = config.encounter.rangedSurge.warningDuration;
  let window: keyof WorldState["stats"]["encounterMetrics"]["movement"] | null = null;
  if (
    world.state.elapsed >= scheduledAt - warningDuration * 2 &&
    world.state.elapsed < scheduledAt - warningDuration
  ) {
    window = "baseline";
  } else if (world.encounter.rangedSurge.phase === "warning") {
    window = "warning";
  } else if (world.encounter.rangedSurge.phase === "active") {
    window = "active";
  } else if (world.encounter.rangedSurge.phase === "recovery") {
    window = "recovery";
  }
  if (!window) return;

  const metrics = world.stats.encounterMetrics.movement[window];
  metrics.distance += Math.hypot(movement.x, movement.y);
  metrics.vector.x += movement.x;
  metrics.vector.y += movement.y;
}

function roundToMillis(value: number): number {
  return Math.round(value * 1000) / 1000;
}
