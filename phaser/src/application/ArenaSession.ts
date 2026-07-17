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
    const config = applyStageToConfig(this.baseConfig, stage, seed);
    const world = createWorld(config);
    world.state.weaponType = input.weaponType;
    world.state.status = input.status ?? "playing";
    this.active = {
      seed,
      config,
      randomStreams: createRandomStreams(seed),
      world,
      mode,
      stage,
    };
  }

  step(input: InputSnapshot, deltaSeconds: number): StepWorldResult {
    const active = this.requireActive();
    return stepWorld(
      active.world,
      input,
      deltaSeconds,
      active.randomStreams,
      active.config,
    );
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
  stage: StageDefinition,
  seed: number,
): SimulationConfig {
  return {
    ...baseConfig,
    seed,
    arena: {
      width: stage.arena.width,
      height: stage.arena.height,
    },
    player: {
      ...baseConfig.player,
      x: stage.arena.playerStart.x,
      y: stage.arena.playerStart.y,
    },
    obstacles: stage.obstacles.map((obstacle) => ({ ...obstacle })),
  };
}
