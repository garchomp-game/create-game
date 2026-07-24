import { EX_PROTOCOL_CATALOG } from "../src/content/exProtocolCatalog";
import type {
  InputSnapshot,
  SimulationConfig,
  Vec2,
  WorldState,
} from "../src/domain/types";

export type ExProtocolProbePath = {
  protocolId: string;
  evolutionOneId: string;
  evolutionTwoId: string;
};

export function createExProtocolProbeInput(
  world: WorldState,
  config: SimulationConfig,
  baseInput: InputSnapshot,
  path: ExProtocolProbePath,
): InputSnapshot {
  const input = cloneInput(baseInput);
  const pending = world.progression.pendingChoice;
  if (
    world.state.status === "protocolSelect" &&
    pending?.kind === "protocol"
  ) {
    input.upgradeChoicePressed = requireChoiceIndex(
      pending.choices,
      path.protocolId,
      pending.kind,
    );
    return input;
  }
  if (
    world.state.status === "evolutionSelect" &&
    pending?.kind === "evolution-one"
  ) {
    input.upgradeChoicePressed = requireChoiceIndex(
      pending.choices,
      path.evolutionOneId,
      pending.kind,
    );
    return input;
  }
  if (
    world.state.status === "evolutionSelect" &&
    pending?.kind === "evolution-two"
  ) {
    input.upgradeChoicePressed = requireChoiceIndex(
      pending.choices,
      path.evolutionTwoId,
      pending.kind,
    );
    return input;
  }

  input.specialPressed = shouldPressSpecial(world, config);
  return input;
}

export function shouldPressSpecial(
  world: WorldState,
  config: SimulationConfig,
): boolean {
  if (world.state.status !== "playing") return false;
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return false;
  const runtime = progression.runtime;
  if (runtime.kind === "rebound-overdrive") {
    return (
      runtime.armedUntil === null &&
      runtime.cooldownUntil <= world.state.elapsed &&
      world.state.shotTimer <= 0.05
    );
  }
  if (runtime.kind === "full-span-tidal-sweep") {
    return (
      runtime.charges > 0 &&
      countEnemiesInForwardCone(
        world,
        world.state.lastAim,
        420,
        Math.PI * 0.72,
      ) >= 3
    );
  }
  if (runtime.kind === "breakwater-fan") {
    const definition = EX_PROTOCOL_CATALOG.protocols[4];
    const longBreak = definition.evolutionTwo[0];
    const wideBreak = definition.evolutionTwo[1];
    const range =
      progression.route.evolutionTwoId === longBreak.id
        ? longBreak.rangePx
        : definition.signature.rangePx;
    const angleDegrees =
      progression.route.evolutionTwoId === wideBreak.id
        ? wideBreak.coneAngleDegrees
        : definition.signature.coneAngleDegrees;
    return (
      runtime.charges > 0 &&
      runtime.cooldownUntil <= world.state.elapsed &&
      world.state.hp - runtime.hpCostAtSelection >=
        definition.signature.minimumHpAfterCost &&
      countEnemiesInForwardCone(
        world,
        world.state.lastAim,
        range,
        (angleDegrees * Math.PI) / 180,
      ) >= 3
    );
  }
  return false;
}

function countEnemiesInForwardCone(
  world: WorldState,
  direction: Vec2,
  range: number,
  arcRadians: number,
): number {
  const aim = normalized(direction);
  const minimumDot = Math.cos(arcRadians / 2);
  let count = 0;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const offset = {
      x: enemy.position.x - world.player.position.x,
      y: enemy.position.y - world.player.position.y,
    };
    const distance = Math.hypot(offset.x, offset.y);
    if (distance <= Number.EPSILON || distance > range) continue;
    const dot = (offset.x * aim.x + offset.y * aim.y) / distance;
    if (dot >= minimumDot) count += 1;
  }
  return count;
}

function requireChoiceIndex(
  choices: readonly string[],
  choiceId: string,
  kind: string,
): number {
  const index = choices.indexOf(choiceId);
  if (index < 0) {
    throw new Error(
      `Probe path choice "${choiceId}" is not offered for ${kind}.`,
    );
  }
  return index;
}

function cloneInput(input: InputSnapshot): InputSnapshot {
  return {
    ...input,
    move: { ...input.move },
    aimWorld: input.aimWorld ? { ...input.aimWorld } : null,
  };
}

function normalized(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= Number.EPSILON) return { x: 1, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}
