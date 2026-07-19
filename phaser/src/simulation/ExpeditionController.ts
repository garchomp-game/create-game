import {
  FINAL_EXPEDITION_ACTS,
  FINAL_EXPEDITION_ENCOUNTER_CARDS,
  FINAL_EXPEDITION_ENCOUNTER_DECK,
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
import { calculateExpeditionCompletionRewards } from "./expeditionScoring";
import { spawnTelegraphCharger } from "./systems/chargerEnemySystem";
import {
  retireCommanderElite,
  spawnCommanderElite,
} from "./systems/commanderEliteSystem";
import {
  spawnFinalExpeditionBoss,
  updateFinalExpeditionBoss,
} from "./systems/bossSystem";
import {
  getSpawnWave,
  spawnEnemyAtPosition,
} from "./systems/spawnSystem";

const ACT_OBJECTIVES: Record<string, string> = {
  "perimeter-watch": "四方から侵入する先遣隊を迎撃する",
  "first-assault": "重装体を分断し各個撃破する",
  counterattack: "指揮個体を撃破する",
  breakthrough: "高速体と射撃体の包囲を突破する",
  "command-ship": "敵指揮艦と増援を同時に撃破する",
};

export class ExpeditionController {
  private readonly director = new EncounterDirector({
    deck: FINAL_EXPEDITION_ENCOUNTER_DECK,
    cards: FINAL_EXPEDITION_ENCOUNTER_CARDS,
    acts: FINAL_EXPEDITION_ACTS,
  });

  constructor(private readonly stage: StageDefinition) {}

  initialize(world: WorldState, random: RandomStreams): void {
    const firstAct = FINAL_EXPEDITION_ACTS[0]!;
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
      boss: null,
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
      tacticalScore: 0,
      scoreBeforeBonus: 0,
      clearScoreBonus: 0,
      timeScoreBonus: 0,
      timeMedal: null,
      bossFightDuration: null,
      cardHistory: [],
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

    const bossEvents = updateFinalExpeditionBoss(
      world,
      random,
      config,
      baseEvents,
    );
    const events: GameEvent[] = [...bossEvents];
    if (world.state.hp <= 0 && world.state.status === "playing") {
      world.state.status = "gameOver";
      events.push({
        type: "game.over",
        score: world.state.score,
        elapsed: world.state.elapsed,
      });
      events.push(this.complete(world, "defeat"));
      return events;
    }
    const signals: string[] = [];
    if (bossEvents.some((event) => event.type === "boss.defeated")) {
      signals.push("boss-defeated");
    }
    if (baseEvents.some((event) => event.type === "elite.commander.killed")) {
      signals.push("commander-defeated");
    }
    const directorEvents = this.director.update(
      expedition.director,
      {
        runElapsed: world.state.elapsed,
        threatTier: getThreatTier(config, world.state.elapsed),
        signals,
      },
      random.encounter,
    );
    for (const event of directorEvents) {
      events.push(...this.applyDirectorEvent(world, event, random, config));
    }

    const defeatedBoss = bossEvents.find(
      (event): event is Extract<GameEvent, { type: "boss.defeated" }> =>
        event.type === "boss.defeated",
    );
    if (
      this.stage.clearCondition.type === "bossDefeat" &&
      defeatedBoss?.bossId === this.stage.clearCondition.bossId &&
      world.state.status === "playing"
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
      const act = FINAL_EXPEDITION_ACTS.find((item) => item.id === event.actId)!;
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
    if (event.type === "encounter.card.deployment.requested") {
      const card = this.director.getCard(event.cardId);
      const deployment = this.deployStructuredSpawn(
        world,
        card.id,
        card.tags,
        card.spawn.geometryId,
        expedition.currentDirection!,
        card.spawn.budget,
        card.spawn.enemyWeights,
        random,
        config,
      );
      const transitionEvents = this.director.reportDeployment(
        expedition.director,
        deployment.status === "deployed"
          ? { status: "deployed", elapsed: world.state.elapsed }
          : {
              status: "deferred",
              elapsed: world.state.elapsed,
              reason: deployment.reason,
            },
        random.encounter,
      );
      return [
        {
          type: "expedition.encounter.deployment.requested",
          cardId: event.cardId,
          attempt: event.attempt,
          elapsed: event.elapsed,
          deadlineAt: event.deadlineAt,
        },
        ...deployment.events,
        ...transitionEvents.flatMap((transitionEvent) =>
          this.applyDirectorEvent(world, transitionEvent, random, config),
        ),
      ];
    }
    if (event.type === "encounter.card.deployment.deferred") {
      return [{
        type: "expedition.encounter.deployment.deferred",
        cardId: event.cardId,
        attempt: event.attempt,
        elapsed: event.elapsed,
        reason: event.reason,
        nextAttemptAt: event.nextAttemptAt,
      }];
    }
    if (event.type === "encounter.card.active.started") {
      const card = this.director.getCard(event.cardId);
      if (card.tags.includes("boss")) {
        const bossEvents: GameEvent[] = [{
          type: "expedition.encounter.active.started",
          cardId: card.id,
          elapsed: event.elapsed,
        }];
        spawnFinalExpeditionBoss(world, bossEvents);
        return bossEvents;
      }
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
        ...(card.deployment
          ? []
          : this.deployStructuredSpawn(
              world,
              card.id,
              card.tags,
              card.spawn.geometryId,
              expedition.currentDirection!,
              card.spawn.budget,
              card.spawn.enemyWeights,
              random,
              config,
            ).events),
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
    const terminalEvent: GameEvent = {
      type,
      cardId: event.cardId,
      elapsed: event.elapsed,
      reason: event.reason,
    };
    if (event.type !== "encounter.card.failed") return [terminalEvent];

    const card = this.director.getCard(event.cardId);
    if (!card.tags.includes("commander")) return [terminalEvent];
    const retirementEvents: GameEvent[] = [];
    const commander = world.enemies.find(
      (enemy) => enemy.elite?.kind === "commander",
    );
    if (commander) {
      retireCommanderElite(world, commander, event.reason, retirementEvents);
    }
    return [terminalEvent, ...retirementEvents];
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
  ):
    | { status: "deployed"; events: GameEvent[] }
    | { status: "deferred"; reason: string; events: GameEvent[] } {
    const expedition = world.expedition!;
    const cardKey = `${cardId}:${expedition.director.selectedAt}`;
    if (expedition.deployedCardKey === cardKey) {
      return { status: "deployed", events: [] };
    }

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
        spawnAt:
          expedition.director.phase === "deploying"
            ? world.state.elapsed
            : expedition.director.activeStartedAt!,
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
      const reason = plan.deferReason ?? "unknown";
      return {
        status: "deferred",
        reason,
        events: [{
          type: "expedition.spawn.deferred",
          cardId,
          reason,
          elapsed: world.state.elapsed,
        }],
      };
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

    if (enemyIds.length === 0) {
      return {
        status: "deferred",
        reason: "spawnRejected",
        events: [{
          type: "expedition.spawn.deferred",
          cardId,
          reason: "spawnRejected",
          elapsed: world.state.elapsed,
        }],
      };
    }

    expedition.deployedCardKey = cardKey;
    return {
      status: "deployed",
      events: [
        ...spawnEvents,
        {
          type: "expedition.spawn.deployed",
          cardId,
          enemyIds,
          elapsed: world.state.elapsed,
        },
      ],
    };
  }

  private complete(
    world: WorldState,
    outcome: "victory" | "defeat",
  ): Extract<GameEvent, { type: "expedition.completed" | "expedition.failed" }> {
    const expedition = world.expedition!;
    const tacticalScore = world.state.score;
    const bossFightDuration = expedition.boss
      ? Math.max(0, world.state.elapsed - expedition.boss.spawnedAt)
      : null;
    const { clearScoreBonus, timeScoreBonus, timeMedal } =
      calculateExpeditionCompletionRewards(
        outcome,
        world.state.elapsed,
        this.stage.completionScoring,
      );
    world.state.score += clearScoreBonus + timeScoreBonus;
    expedition.status = outcome;
    expedition.outcome = outcome;
    expedition.completedAt = world.state.elapsed;
    expedition.spawnOverride = null;
    return {
      type: outcome === "victory" ? "expedition.completed" : "expedition.failed",
      actId: expedition.actId,
      elapsed: world.state.elapsed,
      score: world.state.score,
      tacticalScore,
      scoreBeforeBonus: tacticalScore,
      clearScoreBonus,
      timeScoreBonus,
      timeMedal,
      bossFightDuration,
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
