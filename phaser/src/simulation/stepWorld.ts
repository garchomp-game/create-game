import type {
  GameEvent,
  InputSnapshot,
  RandomSource,
  SimulationConfig,
  StepWorldResult,
  WorldState,
} from "../domain/types";
import { updateAim } from "./systems/aimingSystem";
import { updateBullets } from "./systems/bulletSystem";
import { resolveCombat } from "./systems/combatSystem";
import { updateEnemies } from "./systems/enemySystem";
import { updateEnemyProjectiles } from "./systems/enemyProjectileSystem";
import { updateGameOver } from "./systems/gameOverSystem";
import { updateLevelProgression } from "./systems/levelSystem";
import { updatePickups } from "./systems/pickupSystem";
import { updatePlayer } from "./systems/playerSystem";
import { updateShooting } from "./systems/shootingSystem";
import { updateSpawner } from "./systems/spawnSystem";
import { updateRunStats } from "./systems/statsSystem";
import { chooseUpgrade } from "./systems/upgradeSystem";
import { getWaveBand } from "./waveDirector";

export function stepWorld(
  world: WorldState,
  input: InputSnapshot,
  deltaSeconds: number,
  random: RandomSource,
  config: SimulationConfig,
): StepWorldResult {
  const events: GameEvent[] = [];
  const rawDt = Math.max(0, deltaSeconds);
  const dt = Math.min(rawDt, 0.05);

  if (world.state.status === "title") {
    if (input.startPressed) {
      world.state.status = "playing";
      events.push({ type: "game.started" });
    }
    return collectResult(world, 0, rawDt, config, events);
  }

  if (world.state.status === "gameOver") {
    if (input.restartPressed || input.startPressed) {
      events.push({ type: "game.restart.requested" });
    } else if (input.quitToTitlePressed) {
      events.push({ type: "game.title.requested" });
    }
    return collectResult(world, dt, rawDt, config, events);
  }

  if (world.state.status === "upgradeSelect") {
    if (input.upgradeChoicePressed !== null) {
      chooseUpgrade(world, input.upgradeChoicePressed, config, events);
      updateRunStats(world, events);
    }
    return collectResult(world, 0, rawDt, config, events);
  }

  if (world.state.status === "paused") {
    if (input.restartPressed) {
      events.push({ type: "game.restart.requested" });
    } else if (input.quitToTitlePressed) {
      events.push({ type: "game.title.requested" });
    } else if (input.pausePressed) {
      world.state.status = "playing";
      events.push({ type: "game.resumed", elapsed: world.state.elapsed });
    }
    return collectResult(world, 0, rawDt, config, events);
  }

  if (input.pausePressed) {
    if (world.state.status === "playing") {
      world.state.status = "paused";
      events.push({ type: "game.paused", elapsed: world.state.elapsed });
    }
    return collectResult(world, 0, rawDt, config, events);
  }

  world.state.elapsed += dt;
  world.state.shotTimer -= dt;
  world.state.damageCooldown = Math.max(0, world.state.damageCooldown - dt);

  updateAim(world, input);
  updatePlayer(world, input.move, dt, config);
  updateShooting(world, input.shootHeld, config, events);
  updateBullets(world, dt, config);
  updateSpawner(world, dt, random, config, events);
  updateEnemies(world, dt, config, events);
  updateEnemyProjectiles(world, dt, config);
  resolveCombat(world, config, events);
  updatePickups(world, config, events, dt);
  updateLevelProgression(world, random, config, events);
  updateGameOver(world, events);
  updateRunStats(world, events);

  return collectResult(world, dt, rawDt, config, events);
}

function collectResult(
  world: WorldState,
  dt: number,
  rawDt: number,
  config: SimulationConfig,
  events: GameEvent[],
): StepWorldResult {
  const wave = getWaveBand(config, world.state.elapsed);
  return {
    events,
    metrics: [
      { type: "timing", name: "frame.raw_dt_ms", valueMs: rawDt * 1000 },
      { type: "timing", name: "frame.dt_ms", valueMs: dt * 1000 },
      { type: "gauge", name: "world.bullets", value: world.bullets.length },
      { type: "gauge", name: "world.enemies", value: world.enemies.length },
      {
        type: "gauge",
        name: "world.enemy_projectiles",
        value: world.enemyProjectiles.length,
      },
      { type: "gauge", name: "world.pickups", value: world.pickups.length },
      { type: "gauge", name: "wave.start", value: wave.start },
      { type: "gauge", name: "wave.spawn_budget", value: wave.spawnBudget },
      { type: "gauge", name: "wave.max_enemies", value: wave.maxEnemies },
    ],
  };
}
