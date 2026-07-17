import {
  FIRST_EXPEDITION_ACTS,
  FIRST_EXPEDITION_ENCOUNTER_CARDS,
  FIRST_EXPEDITION_ENCOUNTER_DECK,
} from "../content/expeditionEncounterCards";
import type { StageDefinition } from "../domain/gameContent";
import type {
  EncounterDirectorEvent,
  EncounterDirection,
} from "../domain/encounterDirector";
import type {
  EnemyTypeId,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../domain/types";
import type { RandomStreams } from "../math/random";
import { getThreatTier } from "./threatDirector";
import { EncounterDirector } from "./EncounterDirector";
import { estimatePointNavigationPath } from "./navigationField";
import { planStructuredSpawn } from "./structuredSpawnPlanner";
import { spawnTelegraphCharger } from "./systems/chargerEnemySystem";
import { spawnCommanderElite } from "./systems/commanderEliteSystem";
import {
  getSpawnWave,
  spawnEnemyAtPosition,
} from "./systems/spawnSystem";

const ACT_OBJECTIVES: Record<string, string> = {
  deployment: "展開地点を確保する",
  "first-assault": "第一波を迎撃する",
  counterattack: "指揮個体を崩し反撃する",
  breakthrough: "包囲を突破し作戦限界まで耐える",
};

export class ExpeditionController {
  private readonly director = new EncounterDirector({
    deck: FIRST_EXPEDITION_ENCOUNTER_DECK,
    cards: FIRST_EXPEDITION_ENCOUNTER_CARDS,
    acts: FIRST_EXPEDITION_ACTS,
  });

  constructor(private readonly stage: StageDefinition) {}

  initialize(world: WorldState, random: RandomStreams): void {
    const firstAct = FIRST_EXPEDITION_ACTS[0]!;
    world.expedition = {
      status: "active",
      director: this.director.createState(random.encounter),
      actId: firstAct.id,
      actTitleKey: firstAct.titleKey,
      actStartedAt: 0,
      objective: ACT_OBJECTIVES[firstAct.id]!,
      reachedActIds: [],
      currentCardTitleKey: null,
      currentDirection: null,
      currentGeometryId: null,
      spawnOverride: null,
      deployedCardKey: null,
      outcome: null,
      completedAt: null,
    };
    world.stats.encounterMetrics.expedition = {
      outcome: null,
      reachedActId: null,
      reachedActIds: [],
      actChanges: 0,
      cardsSelected: 0,
      cardsCompleted: 0,
      cardsFailed: 0,
      cardsInterrupted: 0,
      cardsDeferred: 0,
      structuredEnemiesSpawned: 0,
      structuredSpawnsDeferred: 0,
      longestMeaningfulGap: 0,
      completedAt: null,
    };
  }

  update(
    world: WorldState,
    random: RandomStreams,
    config: SimulationConfig,
    baseEvents: readonly GameEvent[],
  ): GameEvent[] {
    const expedition = world.expedition;
    if (!expedition || expedition.status !== "active") return [];

    if (baseEvents.some((event) => event.type === "game.over")) {
      return [this.complete(world, "defeat")];
    }

    const events: GameEvent[] = [];
    const directorEvents = this.director.update(
      expedition.director,
      {
        elapsed: world.state.elapsed,
        threatTier: getThreatTier(config, world.state.elapsed),
      },
      random.encounter,
    );
    for (const event of directorEvents) {
      events.push(...this.applyDirectorEvent(world, event, random, config));
    }

    if (
      this.stage.clearCondition.type === "survive" &&
      world.state.status === "playing" &&
      world.state.elapsed >= this.stage.clearCondition.durationSeconds
    ) {
      events.push(this.complete(world, "victory"));
      events.push({
        type: "game.over",
        score: world.state.score,
        elapsed: world.state.elapsed,
      });
      world.state.status = "gameOver";
    }
    return events;
  }

  private applyDirectorEvent(
    world: WorldState,
    event: EncounterDirectorEvent,
    random: RandomStreams,
    config: SimulationConfig,
  ): GameEvent[] {
    const expedition = world.expedition!;
    if (event.type === "encounter.act.changed") {
      const act = FIRST_EXPEDITION_ACTS.find((item) => item.id === event.actId)!;
      expedition.actId = act.id;
      expedition.actTitleKey = act.titleKey;
      expedition.actStartedAt = event.elapsed;
      expedition.objective = ACT_OBJECTIVES[act.id]!;
      if (!expedition.reachedActIds.includes(act.id)) {
        expedition.reachedActIds.push(act.id);
      }
      return [{
        type: "expedition.act.changed",
        actId: act.id,
        titleKey: act.titleKey,
        elapsed: event.elapsed,
      }];
    }
    if (event.type === "encounter.card.selected") {
      const card = this.director.getCard(event.cardId);
      expedition.currentCardTitleKey = card.titleKey;
      expedition.currentDirection = event.direction;
      expedition.currentGeometryId = card.spawn.geometryId;
      expedition.deployedCardKey = null;
      return [{
        type: "expedition.encounter.selected",
        cardId: card.id,
        titleKey: card.titleKey,
        actId: event.actId,
        direction: event.direction,
        elapsed: event.elapsed,
      }];
    }
    if (event.type === "encounter.card.telegraph.started") return [];
    if (event.type === "encounter.card.active.started") {
      const card = this.director.getCard(event.cardId);
      expedition.spawnOverride = {
        intervalMultiplier: card.spawn.intervalMultiplier,
        budget: card.spawn.budget,
        enemyWeights: { ...card.spawn.enemyWeights },
      };
      return [
        {
          type: "expedition.encounter.active.started",
          cardId: card.id,
          elapsed: event.elapsed,
        },
        ...this.deployStructuredSpawn(
          world,
          card.id,
          card.tags,
          card.spawn.geometryId,
          expedition.currentDirection!,
          card.spawn.budget,
          card.spawn.enemyWeights,
          random,
          config,
        ),
      ];
    }
    if (event.type === "encounter.card.recovery.started") {
      expedition.spawnOverride = null;
      return [{
        type: "expedition.encounter.recovery.started",
        cardId: event.cardId,
        elapsed: event.elapsed,
      }];
    }
    if (event.type === "encounter.card.deferred") {
      return [{
        type: "expedition.encounter.deferred",
        actId: event.actId,
        elapsed: event.elapsed,
      }];
    }

    expedition.spawnOverride = null;
    const type = event.type.replace(
      "encounter.card.",
      "expedition.encounter.",
    ) as
      | "expedition.encounter.completed"
      | "expedition.encounter.failed"
      | "expedition.encounter.interrupted";
    return [{
      type,
      cardId: event.cardId,
      elapsed: event.elapsed,
      reason: event.reason,
    }];
  }

  private deployStructuredSpawn(
    world: WorldState,
    cardId: string,
    tags: readonly string[],
    geometryId: Parameters<typeof planStructuredSpawn>[0]["geometryId"],
    direction: EncounterDirection,
    budget: number,
    enemyWeights: Partial<Record<EnemyTypeId, number>>,
    random: RandomStreams,
    config: SimulationConfig,
  ): GameEvent[] {
    const expedition = world.expedition!;
    const cardKey = `${cardId}:${expedition.director.selectedAt}`;
    if (expedition.deployedCardKey === cardKey) return [];
    expedition.deployedCardKey = cardKey;

    const enemyTypes = Object.keys(enemyWeights) as EnemyTypeId[];
    const enemyRadius = Math.max(
      ...enemyTypes.map((typeId) => config.enemies[typeId].radius),
    );
    const wave = getSpawnWave(world, config);
    const plan = planStructuredSpawn(
      {
        geometryId,
        fallbackGeometryId:
          geometryId === "perimeter-random" ? undefined : "perimeter-random",
        direction,
        count: Math.max(2, Math.min(6, budget)),
        arena: {
          ...config.arena,
          playerStart: { x: config.player.x, y: config.player.y },
        },
        obstacles: world.obstacles,
        playerPosition: world.player.position,
        enemyRadius,
        minimumPlayerDistance: 150,
        spawnMargin: 24,
        collapseInset: world.encounter.collapse.inset,
        existingEnemyCount: world.enemies.length,
        maximumEnemies: wave.maxEnemies,
        telegraphStartedAt: expedition.director.selectedAt!,
        spawnAt: expedition.director.activeStartedAt!,
        isReachable: (entryPoint, radius) =>
          estimatePointNavigationPath(
            world,
            entryPoint,
            world.player.position,
            radius,
            config,
          ).reachable,
      },
      random.spawn,
    );
    if (plan.status === "deferred") {
      return [{
        type: "expedition.spawn.deferred",
        cardId,
        reason: plan.deferReason ?? "unknown",
        elapsed: world.state.elapsed,
      }];
    }

    const enemyIds: string[] = [];
    const spawnEvents: GameEvent[] = [];
    plan.placements.forEach((placement, index) => {
      const enemy =
        tags.includes("commander") && index === 0
          ? spawnCommanderElite(world, placement.position, config, spawnEvents)
          : tags.includes("charger") && index === 0
            ? spawnTelegraphCharger(world, placement.position, config, spawnEvents)
            : spawnEnemyAtPosition(
                world,
                selectEnemyType(enemyWeights, random.spawn),
                wave,
                placement.position,
                config,
              );
      if (!enemy) return;
      enemyIds.push(enemy.id);
      if (!(tags.includes("commander") || tags.includes("charger")) || index > 0) {
        spawnEvents.push({
          type: "enemy.spawned",
          enemyId: enemy.id,
          enemyType: enemy.typeId,
          position: { ...enemy.position },
        });
      }
    });

    return [
      ...spawnEvents,
      {
        type: "expedition.spawn.deployed",
        cardId,
        enemyIds,
        elapsed: world.state.elapsed,
      },
    ];
  }

  private complete(
    world: WorldState,
    outcome: "victory" | "defeat",
  ): Extract<GameEvent, { type: "expedition.completed" | "expedition.failed" }> {
    const expedition = world.expedition!;
    expedition.status = outcome;
    expedition.outcome = outcome;
    expedition.completedAt = world.state.elapsed;
    expedition.spawnOverride = null;
    return {
      type: outcome === "victory" ? "expedition.completed" : "expedition.failed",
      actId: expedition.actId,
      elapsed: world.state.elapsed,
      score: world.state.score,
    };
  }
}

function selectEnemyType(
  weights: Partial<Record<EnemyTypeId, number>>,
  random: () => number,
): EnemyTypeId {
  const entries = Object.entries(weights) as [EnemyTypeId, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [typeId, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return typeId;
  }
  return entries.at(-1)![0];
}
