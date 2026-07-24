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
import {
  clonePracticeRunOptions,
  createDefaultPracticeRunOptions,
  type PracticeRunOptions,
} from "../domain/practice";
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
  practiceOptions?: PracticeRunOptions;
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
    const practiceOptions =
      mode.runtimeKind === "practice"
        ? clonePracticeRunOptions(
            input.practiceOptions ?? createDefaultPracticeRunOptions(),
          )
        : null;
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
      practiceOptions,
    );
    const world = createWorld(config);
    if (practiceOptions) {
      world.practice = { options: clonePracticeRunOptions(practiceOptions) };
    }
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
      mode.runtimeKind === "training" || mode.runtimeKind === "story"
        ? new TutorialController({
            flowKind:
              mode.runtimeKind === "story" ? "story" : "basic-training",
          })
        : null;
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

  updatePracticeOptions(options: PracticeRunOptions): void {
    const active = this.requireActive();
    if (active.mode.runtimeKind !== "practice" || !active.world.practice) {
      throw new Error("Practice options require an active Practice session.");
    }
    const nextOptions = clonePracticeRunOptions(options);
    active.world.practice.options = clonePracticeRunOptions(nextOptions);
    active.config.waves.splice(
      0,
      active.config.waves.length,
      createPracticeWave(nextOptions),
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
  practiceOptions: PracticeRunOptions | null,
): SimulationConfig {
  const difficulty = stage.difficulty;
  return {
    ...baseConfig,
    seed,
    ...(rulesetProfile.features.exProtocols
      ? { exProtocolOfferPolicy: stage.exProtocolOfferPolicy }
      : {}),
    features:
      mode.runtimeKind === "expedition" ||
      mode.runtimeKind === "training" ||
      mode.runtimeKind === "story" ||
      mode.runtimeKind === "practice"
        ? {
            ...baseConfig.features,
            exProtocols: rulesetProfile.features.exProtocols,
            encounterDeck: false,
            endlessContract: rulesetProfile.features.endlessContract,
            arenaCollapse: false,
          }
        : {
            ...baseConfig.features,
            exProtocols: rulesetProfile.features.exProtocols,
            endlessContract: rulesetProfile.features.endlessContract,
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
              spawnCost:
                mode.runtimeKind === "practice" ? 1 : enemy.spawnCost,
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
      mode.runtimeKind === "training" || mode.runtimeKind === "story"
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
    waves:
      mode.runtimeKind === "practice" && practiceOptions
        ? [createPracticeWave(practiceOptions)]
        : difficulty
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

function createPracticeWave(
  options: PracticeRunOptions,
): SimulationConfig["waves"][number] {
  const intensity =
    options.intensity === "busy"
      ? {
          spawnInterval: 0.6,
          speedMultiplier: 0.95,
          maxEnemies: 20,
          spawnBudget: 3,
        }
      : options.intensity === "standard"
        ? {
            spawnInterval: 0.9,
            speedMultiplier: 0.85,
            maxEnemies: 12,
            spawnBudget: 2,
          }
        : {
            spawnInterval: 1.4,
            speedMultiplier: 0.75,
            maxEnemies: 6,
            spawnBudget: 1,
          };
  const weights = {
    chaser: 1,
    brute: 0.65,
    fast: 0.9,
    ranged: 0.55,
  } as const;
  return {
    start: 0,
    ...intensity,
    enemyWeights: Object.fromEntries(
      options.enemyTypeIds.map((typeId) => [typeId, weights[typeId]]),
    ),
  };
}
