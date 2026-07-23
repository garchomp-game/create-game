import type {
  EnemyTypeId,
  GameEvent,
  InputSnapshot,
  SimulationConfig,
  StepWorldResult,
  WeaponTypeId,
  WorldState,
} from "../domain/types";
import type { FinalCommandShipDefinition } from "../content/bossCatalog";
import type {
  ModeDefinition,
  StageDefinition,
} from "../domain/gameContent";
import type { TutorialSnapshot } from "../domain/tutorial";
import { createRandomStreams, type RandomStreams } from "../math/random";
import type {
  RulesetProfile,
  RulesetProfileId,
} from "../domain/ruleset";
import { createWorld } from "../simulation/createWorld";
import { stepWorld } from "../simulation/stepWorld";
import { ExpeditionController } from "../simulation/ExpeditionController";
import { TutorialController } from "../simulation/TutorialController";
import { updateRunStats } from "../simulation/systems/statsSystem";
import { initializeExProtocolProgression } from "../simulation/exProtocolProgression";
import { DEFAULT_MODE_ID, DEFAULT_STAGE_ID } from "../config/version";
import type { GameContentRegistry } from "./GameContentRegistry";
import { DEFAULT_GAME_CONTENT_REGISTRY } from "./defaultGameContentRegistry";
import { resolveRulesetProfile } from "./RulesetProfileRegistry";

export type ArenaSessionStartInput = {
  seed: number;
  weaponType: WeaponTypeId;
  status?: WorldState["state"]["status"];
  modeId?: string;
  stageId?: string;
  rulesetProfileId?: RulesetProfileId;
};

export type ArenaSessionOptions = {
  finalExpeditionBossSustain?: FinalCommandShipDefinition["sustain"];
};

type ActiveArenaSession = {
  seed: number;
  config: SimulationConfig;
  randomStreams: RandomStreams;
  world: WorldState;
  mode: ModeDefinition;
  stage: StageDefinition;
  rulesetProfile: RulesetProfile;
  expeditionController: ExpeditionController | null;
  tutorialController: TutorialController | null;
};

export class ArenaSession {
  private active: ActiveArenaSession | null = null;

  constructor(
    private readonly baseConfig: SimulationConfig,
    private readonly contentRegistry: GameContentRegistry =
      DEFAULT_GAME_CONTENT_REGISTRY,
    private readonly options: ArenaSessionOptions = {},
  ) {}

  start(input: ArenaSessionStartInput): void {
    const seed = input.seed >>> 0;
    const { mode, stage } = this.contentRegistry.resolveRun(
      input.modeId ?? DEFAULT_MODE_ID,
      input.stageId ?? DEFAULT_STAGE_ID,
    );
    const rulesetProfile = resolveRulesetProfile(
      mode.id,
      stage.id,
      input.rulesetProfileId,
    );
    if (
      rulesetProfile.features.exProtocols &&
      stage.exProtocolOfferPolicy !== "fixed-compatible"
    ) {
      throw new Error(
        `Stage "${stage.id}" does not allow EX Protocol offers.`,
      );
    }
    const config = applyStageToConfig(
      this.baseConfig,
      mode,
      stage,
      seed,
      rulesetProfile,
    );
    const world = createWorld(config);
    world.state.weaponType = input.weaponType;
    world.state.status = input.status ?? "playing";
    initializeExProtocolProgression(world, config, input.weaponType);
    const expeditionController =
      mode.runtimeKind === "expedition"
        ? new ExpeditionController(
            stage,
            this.options.finalExpeditionBossSustain,
          )
        : null;
    const tutorialController =
      mode.runtimeKind === "training" ? new TutorialController() : null;
    const randomStreams = createRandomStreams(
      seed,
      rulesetProfile.randomStreamVersion,
    );
    expeditionController?.initialize(world, randomStreams);
    tutorialController?.initialize(world, config);
    this.active = {
      seed,
      config,
      randomStreams,
      world,
      mode,
      stage,
      rulesetProfile,
      expeditionController,
      tutorialController,
    };
  }

  step(input: InputSnapshot, deltaSeconds: number): StepWorldResult {
    const active = this.requireActive();
    const tutorialInput =
      active.tutorialController?.prepareInput(input) ?? input;
    const trainingUpgradeControl = getTrainingUpgradeControl(active, input);
    const stepInput = trainingUpgradeControl
      ? {
          ...tutorialInput,
          restartPressed: false,
          pausePressed: false,
          quitToTitlePressed: false,
          upgradeChoicePressed: null,
        }
      : tutorialInput;
    const frameBefore = {
      elapsed: active.world.state.elapsed,
      playerPosition: { ...active.world.player.position },
    };
    const result = stepWorld(
      active.world,
      stepInput,
      deltaSeconds,
      active.randomStreams,
      active.config,
    );
    if (trainingUpgradeControl) {
      if (trainingUpgradeControl.type === "game.paused") {
        active.world.state.status = "paused";
      }
      result.events.push(trainingUpgradeControl);
    }
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
    if (active.tutorialController) {
      const tutorialEvents = active.tutorialController.update(
        active.world,
        active.config,
        result.events,
        frameBefore,
        input,
      );
      if (tutorialEvents.length > 0) {
        result.events.push(...tutorialEvents);
        updateRunStats(active.world, tutorialEvents);
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

  get rulesetProfile(): RulesetProfile {
    return this.requireActive().rulesetProfile;
  }

  get recordPolicy(): ModeDefinition["recordPolicy"] {
    return this.requireActive().mode.recordPolicy;
  }

  get runtimeKind(): ModeDefinition["runtimeKind"] {
    return this.requireActive().mode.runtimeKind;
  }

  get tutorialSnapshot(): TutorialSnapshot | null {
    return this.requireActive().tutorialController?.getSnapshot() ?? null;
  }

  private requireActive(): ActiveArenaSession {
    if (!this.active) throw new Error("ArenaSession has not been started.");
    return this.active;
  }
}

function getTrainingUpgradeControl(
  active: ActiveArenaSession,
  input: InputSnapshot,
): GameEvent | null {
  if (
    !active.tutorialController ||
    active.world.state.status !== "upgradeSelect"
  ) {
    return null;
  }
  if (input.restartPressed) return { type: "game.restart.requested" };
  if (input.quitToTitlePressed) return { type: "game.title.requested" };
  if (input.pausePressed) {
    return {
      type: "game.paused",
      elapsed: active.world.state.elapsed,
    };
  }
  return null;
}

function applyStageToConfig(
  baseConfig: SimulationConfig,
  mode: ModeDefinition,
  stage: StageDefinition,
  seed: number,
  rulesetProfile: RulesetProfile,
): SimulationConfig {
  const difficulty = stage.difficulty;
  return {
    ...baseConfig,
    seed,
    ...(rulesetProfile.features.exProtocols
      ? { exProtocolOfferPolicy: stage.exProtocolOfferPolicy }
      : {}),
    features:
      mode.runtimeKind === "expedition" || mode.runtimeKind === "training"
        ? {
            ...baseConfig.features,
            exProtocols: rulesetProfile.features.exProtocols,
            encounterDeck: false,
            endlessContract: false,
            arenaCollapse: false,
          }
        : {
            ...baseConfig.features,
            exProtocols: rulesetProfile.features.exProtocols,
          },
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
              hp: Math.ceil(
                enemy.hp *
                  (difficulty.enemyHpMultipliers?.[typeId as EnemyTypeId] ?? 1),
              ),
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
    pickup:
      mode.runtimeKind === "training"
        ? {
            ...baseConfig.pickup,
            healDropChance: 0,
            healDropPityBonus: 0,
            healDropMaxChance: 0,
          }
        : difficulty
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
    leveling: stage.progression
      ? {
          ...baseConfig.leveling,
          extra: {
            ...baseConfig.leveling.extra,
            ...stage.progression.extraXpCurve,
          },
        }
      : baseConfig.leveling,
    obstacles: stage.obstacles.map((obstacle) => ({ ...obstacle })),
  };
}
