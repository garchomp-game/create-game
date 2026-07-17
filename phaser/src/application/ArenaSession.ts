import type {
  InputSnapshot,
  SimulationConfig,
  StepWorldResult,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import { createRandomStreams, type RandomStreams } from "../math/random";
import { createWorld } from "../simulation/createWorld";
import { stepWorld } from "../simulation/stepWorld";

export type ArenaSessionStartInput = {
  seed: number;
  weaponType: WeaponTypeId;
  status?: WorldState["state"]["status"];
};

type ActiveArenaSession = {
  seed: number;
  config: SimulationConfig;
  randomStreams: RandomStreams;
  world: WorldState;
};

export class ArenaSession {
  private active: ActiveArenaSession | null = null;

  constructor(private readonly baseConfig: SimulationConfig) {}

  start(input: ArenaSessionStartInput): void {
    const seed = input.seed >>> 0;
    const config = { ...this.baseConfig, seed };
    const world = createWorld(config);
    world.state.weaponType = input.weaponType;
    world.state.status = input.status ?? "playing";
    this.active = {
      seed,
      config,
      randomStreams: createRandomStreams(seed),
      world,
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

  private requireActive(): ActiveArenaSession {
    if (!this.active) throw new Error("ArenaSession has not been started.");
    return this.active;
  }
}
