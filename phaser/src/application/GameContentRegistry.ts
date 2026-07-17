import { parseGameContentDefinitions } from "../content/gameContentSchema";
import type {
  EnemyPoolDefinition,
  GameContentDefinitions,
  ModeDefinition,
  ResolvedRunContent,
  StageDefinition,
} from "../domain/gameContent";

export class GameContentRegistry {
  private readonly modes: Map<string, ModeDefinition>;
  private readonly stages: Map<string, StageDefinition>;
  private readonly enemyPools: Map<string, EnemyPoolDefinition>;
  private readonly encounterDeckIds: Set<string>;
  private readonly bossIds: Set<string>;

  constructor(input: unknown) {
    const definitions = parseGameContentDefinitions(input);
    assertUniqueIds("mode", definitions.modes);
    assertUniqueIds("stage", definitions.stages);
    assertUniqueIds("enemy pool", definitions.enemyPools);
    assertUniqueStrings("encounter deck", definitions.encounterDeckIds);
    assertUniqueStrings("boss", definitions.bossIds);

    this.modes = new Map(definitions.modes.map((item) => [item.id, item]));
    this.stages = new Map(definitions.stages.map((item) => [item.id, item]));
    this.enemyPools = new Map(
      definitions.enemyPools.map((item) => [item.id, item]),
    );
    this.encounterDeckIds = new Set(definitions.encounterDeckIds);
    this.bossIds = new Set(definitions.bossIds);
    this.validateReferences(definitions);
  }

  resolveRun(modeId: string, stageId: string): ResolvedRunContent {
    const mode = this.requireMode(modeId);
    if (!mode.stageIds.includes(stageId)) {
      throw new Error(`Stage "${stageId}" is not available for mode "${modeId}".`);
    }
    const stage = this.requireStage(stageId);
    const enemyPool = this.requireEnemyPool(stage.enemyPoolId);
    return structuredClone({ mode, stage, enemyPool });
  }

  getMode(modeId: string): ModeDefinition {
    return structuredClone(this.requireMode(modeId));
  }

  getStage(stageId: string): StageDefinition {
    return structuredClone(this.requireStage(stageId));
  }

  private validateReferences(definitions: GameContentDefinitions): void {
    for (const mode of definitions.modes) {
      if (!mode.stageIds.includes(mode.defaultStageId)) {
        throw new Error(
          `Mode "${mode.id}" default stage must be included in stageIds.`,
        );
      }
      for (const stageId of mode.stageIds) this.requireStage(stageId);
    }

    for (const stage of definitions.stages) {
      this.requireEnemyPool(stage.enemyPoolId);
      if (!this.encounterDeckIds.has(stage.encounterDeckId)) {
        throw new Error(
          `Stage "${stage.id}" references unknown encounter deck "${stage.encounterDeckId}".`,
        );
      }
      validateArena(stage);
      validateClearCondition(stage, this.bossIds);
    }
  }

  private requireMode(id: string): ModeDefinition {
    const mode = this.modes.get(id);
    if (!mode) throw new Error(`Unknown mode ID "${id}".`);
    return mode;
  }

  private requireStage(id: string): StageDefinition {
    const stage = this.stages.get(id);
    if (!stage) throw new Error(`Unknown stage ID "${id}".`);
    return stage;
  }

  private requireEnemyPool(id: string): EnemyPoolDefinition {
    const enemyPool = this.enemyPools.get(id);
    if (!enemyPool) throw new Error(`Unknown enemy pool ID "${id}".`);
    return enemyPool;
  }
}

function validateArena(stage: StageDefinition): void {
  const { arena } = stage;
  if (
    arena.playerStart.x > arena.width ||
    arena.playerStart.y > arena.height
  ) {
    throw new Error(`Stage "${stage.id}" player start is outside the arena.`);
  }
  const obstacleIds = new Set<string>();
  for (const obstacle of stage.obstacles) {
    if (obstacleIds.has(obstacle.id)) {
      throw new Error(
        `Stage "${stage.id}" has duplicate obstacle ID "${obstacle.id}".`,
      );
    }
    obstacleIds.add(obstacle.id);
    if (
      obstacle.x + obstacle.width > arena.width ||
      obstacle.y + obstacle.height > arena.height
    ) {
      throw new Error(
        `Stage "${stage.id}" obstacle "${obstacle.id}" is outside the arena.`,
      );
    }
  }
}

function validateClearCondition(
  stage: StageDefinition,
  bossIds: ReadonlySet<string>,
): void {
  if (stage.clearCondition.type === "bossDefeat") {
    if (stage.bossId !== stage.clearCondition.bossId) {
      throw new Error(
        `Stage "${stage.id}" boss clear condition must match bossId.`,
      );
    }
    if (!bossIds.has(stage.clearCondition.bossId)) {
      throw new Error(
        `Stage "${stage.id}" references unknown boss "${stage.clearCondition.bossId}".`,
      );
    }
    return;
  }
  if (stage.bossId) {
    throw new Error(
      `Stage "${stage.id}" cannot declare bossId without a bossDefeat clear condition.`,
    );
  }
}

function assertUniqueIds(
  kind: string,
  definitions: readonly { id: string }[],
): void {
  assertUniqueStrings(
    kind,
    definitions.map((definition) => definition.id),
  );
}

function assertUniqueStrings(kind: string, values: readonly string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${kind} ID "${value}".`);
    seen.add(value);
  }
}
