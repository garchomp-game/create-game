import type {
  InputSnapshot,
  SimulationConfig,
  StepWorldResult,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import type {
  ModeDefinition,
  StageDefinition,
} from "../domain/gameContent";
import { createRandomStreams, type RandomStreams } from "../math/random";
import { createWorld } from "../simulation/createWorld";
import { stepWorld } from "../simulation/stepWorld";
import { ExpeditionController } from "../simulation/ExpeditionController";
import { updateRunStats } from "../simulation/systems/statsSystem";
import { DEFAULT_MODE_ID, DEFAULT_STAGE_ID } from "../config/version";
import type { GameContentRegistry } from "./GameContentRegistry";
import { DEFAULT_GAME_CONTENT_REGISTRY } from "./defaultGameContentRegistry";

export type ArenaSessionStartInput = {
  seed: number;
  weaponType: WeaponTypeId;
  status?: WorldState["state"]["status"];
  modeId?: string;
  stageId?: string;
};

type ActiveArenaSession = {
  seed: number;
  config: SimulationConfig;
  randomStreams: RandomStreams;
  world: WorldState;
  mode: ModeDefinition;
  stage: StageDefinition;
  expeditionController: ExpeditionController | null;
};

export class ArenaSession {
  private active: ActiveArenaSession | null = null;

  constructor(
    private readonly baseConfig: SimulationConfig,
    private readonly contentRegistry: GameContentRegistry =
      DEFAULT_GAME_CONTENT_REGISTRY,
  ) {}

  start(input: ArenaSessionStartInput): void {
    const seed = input.seed >>> 0;
    const { mode, stage } = this.contentRegistry.resolveRun(
      input.modeId ?? DEFAULT_MODE_ID,
      input.stageId ?? DEFAULT_STAGE_ID,
    );
    const config = applyStageToConfig(this.baseConfig, mode, stage, seed);
    const world = createWorld(config);
    world.state.weaponType = input.weaponType;
    world.state.status = input.status ?? "playing";
    const expeditionController =
      mode.runtimeKind === "expedition"
        ? new ExpeditionController(stage)
        : null;
    const randomStreams = createRandomStreams(seed);
    expeditionController?.initialize(world, randomStreams);
    this.active = {
      seed,
      config,
      randomStreams,
      world,
      mode,
      stage,
      expeditionController,
    };
  }

  step(input: InputSnapshot, deltaSeconds: number): StepWorldResult {
    const active = this.requireActive();
    const result = stepWorld(
      active.world,
      input,
      deltaSeconds,
      active.randomStreams,
      active.config,
    );
    if (active.expeditionController) {
      const expeditionEvents = active.expeditionController.update(
        active.world,
        active.randomStreams,
        active.config,
        result.events,
      );
      if (expeditionEvents.length > 0) {
        result.events.push(...expeditionEvents);
        updateRunStats(active.world, expeditionEvents);
      }
    }
    return result;
  }

  get seed(): number {
    return this.requireActive().seed;
  }

  get config(): SimulationConfig {
    return this.requireActive().config;
  }

  get randomStreams(): RandomStreams {
    return this.requireActive().randomStreams;
  }

  get world(): WorldState {
    return this.requireActive().world;
  }

  get modeId(): string {
    return this.requireActive().mode.id;
  }

  get stageId(): string {
    return this.requireActive().stage.id;
  }

  get stage(): StageDefinition {
    return structuredClone(this.requireActive().stage);
  }

  private requireActive(): ActiveArenaSession {
    if (!this.active) throw new Error("ArenaSession has not been started.");
    return this.active;
  }
}

function applyStageToConfig(
  baseConfig: SimulationConfig,
  mode: ModeDefinition,
  stage: StageDefinition,
  seed: number,
): SimulationConfig {
  const difficulty = stage.difficulty;
  return {
    ...baseConfig,
    seed,
    features:
      mode.runtimeKind === "expedition"
        ? {
            ...baseConfig.features,
            encounterDeck: false,
            endlessContract: false,
            arenaCollapse: false,
          }
        : { ...baseConfig.features },
    arena: {
      width: stage.arena.width,
      height: stage.arena.height,
    },
    player: {
      ...baseConfig.player,
      x: stage.arena.playerStart.x,
      y: stage.arena.playerStart.y,
    },
    enemies: difficulty
      ? Object.fromEntries(
          Object.entries(baseConfig.enemies).map(([typeId, enemy]) => [
            typeId,
            {
              ...enemy,
              xpValue: Math.ceil(
                enemy.xpValue * difficulty.rewardScaling.enemyXpMultiplier,
              ),
              score: Math.round(
                enemy.score * difficulty.rewardScaling.enemyScoreMultiplier,
              ),
            },
          ]),
        ) as SimulationConfig["enemies"]
      : baseConfig.enemies,
    pickup: difficulty
      ? {
          ...baseConfig.pickup,
          healDropChance: Math.min(
            1,
            baseConfig.pickup.healDropChance *
              difficulty.rewardScaling.healDropChanceMultiplier,
          ),
        }
      : baseConfig.pickup,
    waves: difficulty
      ? difficulty.waves.map((wave) => ({
          ...wave,
          enemyWeights: { ...wave.enemyWeights },
        }))
      : baseConfig.waves,
    threat: difficulty
      ? {
          ...baseConfig.threat,
          ...difficulty.threat,
        }
      : baseConfig.threat,
    obstacles: stage.obstacles.map((obstacle) => ({ ...obstacle })),
  };
}
