import type {
  EncounterActDefinition,
  EncounterCardDefinition,
  EncounterDeckDefinition,
} from "../domain/encounterDirector";
import { ENCOUNTER_DIRECTIONS } from "../domain/encounterDirector";
import { ENCOUNTER_IDS, type SimulationConfig } from "../domain/types";

export const ENDLESS_ENCOUNTER_DECK_ID = "endless-v1";

export const ENDLESS_ENCOUNTER_ACTS: EncounterActDefinition[] = [
  { id: "endless", titleKey: "act.endless.title", startsAt: 0 },
];

export function createEndlessEncounterDeck(
  config: SimulationConfig,
): EncounterDeckDefinition {
  return {
    id: ENDLESS_ENCOUNTER_DECK_ID,
    cardIds: [...ENCOUNTER_IDS],
    directionIds: [...ENCOUNTER_DIRECTIONS],
    initialDelay: {
      minSeconds: config.encounter.director.minStart,
      maxSeconds: config.encounter.director.maxStart,
    },
    interval: {
      minSeconds: config.encounter.director.minInterval,
      maxSeconds: config.encounter.director.maxInterval,
    },
    retryDelaySeconds: 1,
  };
}

export function createEndlessEncounterCards(
  config: SimulationConfig,
): EncounterCardDefinition[] {
  return ENCOUNTER_IDS.map((encounterId) => {
    const definition = config.encounter.director.definitions[encounterId];
    return {
      id: encounterId,
      titleKey: `encounter.${encounterId}.title`,
      tags: [encounterId],
      actIds: ["endless"],
      blocksActClock: false,
      deployment: null,
      timing: {
        telegraphSeconds: definition.warningDuration,
        activeSeconds: definition.activeDuration,
        recoverySeconds: definition.recoveryDuration,
      },
      spawn: {
        intervalMultiplier: definition.spawnIntervalMultiplier,
        budget: definition.spawnBudget,
        enemyWeights: { ...definition.enemyWeights },
        geometryId: "perimeter-random",
      },
      minimumThreatTier: 0,
      cooldownSeconds: 0,
      weight: 1,
      completionCondition: { type: "duration" },
      failureSignalIds: [],
      interruptSignalIds: [],
    };
  });
}
