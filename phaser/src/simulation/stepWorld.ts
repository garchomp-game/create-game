import type {
  GameEvent,
  InputSnapshot,
  SimulationConfig,
  StepWorldResult,
  WorldState,
} from "../domain/types";
import type { RandomStreams } from "../math/random";
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
import { updateArenaCollapse } from "./systems/collapseSystem";
import { updateCommanderElites } from "./systems/commanderEliteSystem";
import { chooseUpgrade } from "./systems/upgradeSystem";
import {
  chooseEndlessContract,
  recordEncounterMovement,
  updateEncounter,
} from "./systems/encounterSystem";
import { getWaveBand } from "./waveDirector";
import { getThreatTier } from "./threatDirector";
import { getDifficultyElapsed } from "./difficultyClock";

export function stepWorld(
  world: WorldState,
  input: InputSnapshot,
  deltaSeconds: number,
  random: RandomStreams,
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

  if (world.state.status === "weaponSelect") {
    return collectResult(world, 0, rawDt, config, events);
  }

  if (world.state.status === "contractSelect") {
    if (input.contractChoicePressed !== null && input.contractChoicePressed !== undefined) {
      chooseEndlessContract(world, input.contractChoicePressed, config, events);
      updateRunStats(world, events);
    }
    return collectResult(world, 0, rawDt, config, events);
  }

  if (world.state.status === "trainingBriefing") {
    if (input.restartPressed) {
      events.push({ type: "game.restart.requested" });
    } else if (input.quitToTitlePressed) {
      events.push({ type: "game.title.requested" });
    } else if (input.pausePressed) {
      world.state.status = "paused";
      events.push({ type: "game.paused", elapsed: world.state.elapsed });
    }
    return collectResult(world, 0, rawDt, config, events);
  }

  if (world.state.status === "trainingComplete") {
    if (input.quitToTitlePressed || input.pausePressed) {
      events.push({ type: "game.title.requested" });
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
  updateEncounter(world, random.encounter, config, events);
  if (world.encounter.contract.status === "offered") {
    updateRunStats(world, events);
    return collectResult(world, dt, rawDt, config, events);
  }

  updateAim(world, input);
  const playerPositionBeforeMove = { ...world.player.position };
  updatePlayer(world, input.move, dt, config);
  world.stats.movementDistance += Math.hypot(
    world.player.position.x - playerPositionBeforeMove.x,
    world.player.position.y - playerPositionBeforeMove.y,
  );
  recordEncounterMovement(
    world,
    {
      x: world.player.position.x - playerPositionBeforeMove.x,
      y: world.player.position.y - playerPositionBeforeMove.y,
    },
    config,
  );
  updateArenaCollapse(world, dt, config, events);
  updateShooting(world, input.shootHeld, config, events);
  const bulletMotions = updateBullets(world, dt, config);
  updateSpawner(world, dt, random.spawn, config, events);
  if ((world.eliteState?.commanderIds.length ?? 0) > 0) {
    updateCommanderElites(world, random.spawn, config, events);
  }
  updateEnemies(world, dt, config, events);
  updateEnemyProjectiles(world, dt, config);
  resolveCombat(world, config, events, bulletMotions);
  updatePickups(world, config, events, dt);
  updateLevelProgression(world, random.upgrade, config, events);
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
  const difficultyElapsed = getDifficultyElapsed(world);
  const wave = getWaveBand(config, difficultyElapsed);
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
      { type: "gauge", name: "world.difficulty_elapsed", value: difficultyElapsed },
      { type: "gauge", name: "wave.start", value: wave.start },
      { type: "gauge", name: "wave.spawn_budget", value: wave.spawnBudget },
      { type: "gauge", name: "wave.max_enemies", value: wave.maxEnemies },
      {
        type: "gauge",
        name: "endless.threat_tier",
        value: getThreatTier(config, difficultyElapsed),
      },
      {
        type: "gauge",
        name: "endless.collapse_stage",
        value: world.encounter.collapse.stage,
      },
    ],
  };
}
