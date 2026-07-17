import type {
  EncounterActDefinition,
  EncounterCardDefinition,
  EncounterDeckDefinition,
} from "../domain/encounterDirector";
import { ENCOUNTER_DIRECTIONS } from "../domain/encounterDirector";

export const FIRST_EXPEDITION_ENCOUNTER_DECK_ID = "first-expedition-v1";

export const FIRST_EXPEDITION_ACTS: EncounterActDefinition[] = [
  { id: "deployment", titleKey: "act.deployment.title", startsAt: 0 },
  { id: "first-assault", titleKey: "act.first-assault.title", startsAt: 75 },
  { id: "counterattack", titleKey: "act.counterattack.title", startsAt: 180 },
  { id: "breakthrough", titleKey: "act.breakthrough.title", startsAt: 300 },
];

export const FIRST_EXPEDITION_ENCOUNTER_CARDS: EncounterCardDefinition[] = [
  {
    id: "vanguard-arc",
    titleKey: "encounter.vanguard-arc.title",
    tags: ["vanguard"],
    actIds: ["deployment", "first-assault"],
    timing: { telegraphSeconds: 1.4, activeSeconds: 18, recoverySeconds: 3 },
    spawn: {
      intervalMultiplier: 0.82,
      budget: 4,
      enemyWeights: { chaser: 1.4, fast: 0.8 },
      geometryId: "arc",
    },
    minimumThreatTier: 0,
    cooldownSeconds: 24,
    weight: 2,
    completionCondition: { type: "duration" },
    failureSignalIds: [],
    interruptSignalIds: [],
  },
  {
    id: "crossfire-pincer",
    titleKey: "encounter.crossfire-pincer.title",
    tags: ["crossfire"],
    actIds: ["first-assault"],
    timing: { telegraphSeconds: 1.6, activeSeconds: 20, recoverySeconds: 3.5 },
    spawn: {
      intervalMultiplier: 0.76,
      budget: 5,
      enemyWeights: { chaser: 0.8, fast: 0.7, ranged: 1.5 },
      geometryId: "pincer",
    },
    minimumThreatTier: 0,
    cooldownSeconds: 30,
    weight: 2,
    completionCondition: { type: "duration" },
    failureSignalIds: [],
    interruptSignalIds: [],
  },
  {
    id: "heavy-escort",
    titleKey: "encounter.heavy-escort.title",
    tags: ["heavy"],
    actIds: ["first-assault"],
    timing: { telegraphSeconds: 1.8, activeSeconds: 22, recoverySeconds: 4 },
    spawn: {
      intervalMultiplier: 0.78,
      budget: 6,
      enemyWeights: { chaser: 0.8, brute: 1.7, ranged: 0.6 },
      geometryId: "escort",
    },
    minimumThreatTier: 0,
    cooldownSeconds: 36,
    weight: 2,
    completionCondition: { type: "duration" },
    failureSignalIds: [],
    interruptSignalIds: [],
  },
  {
    id: "commander-counterattack",
    titleKey: "encounter.commander-counterattack.title",
    tags: ["commander"],
    actIds: ["counterattack"],
    timing: { telegraphSeconds: 2.2, activeSeconds: 24, recoverySeconds: 4 },
    spawn: {
      intervalMultiplier: 0.84,
      budget: 5,
      enemyWeights: { chaser: 1.2, ranged: 1.1 },
      geometryId: "escort",
    },
    minimumThreatTier: 0,
    cooldownSeconds: 150,
    weight: 1,
    completionCondition: { type: "duration" },
    failureSignalIds: [],
    interruptSignalIds: [],
  },
  {
    id: "charger-breakthrough",
    titleKey: "encounter.charger-breakthrough.title",
    tags: ["charger"],
    actIds: ["breakthrough"],
    timing: { telegraphSeconds: 2, activeSeconds: 22, recoverySeconds: 4 },
    spawn: {
      intervalMultiplier: 0.72,
      budget: 6,
      enemyWeights: { chaser: 0.7, fast: 1.6, ranged: 0.6 },
      geometryId: "arc",
    },
    minimumThreatTier: 0,
    cooldownSeconds: 150,
    weight: 2,
    completionCondition: { type: "duration" },
    failureSignalIds: [],
    interruptSignalIds: [],
  },
];

export const FIRST_EXPEDITION_ENCOUNTER_DECK: EncounterDeckDefinition = {
  id: FIRST_EXPEDITION_ENCOUNTER_DECK_ID,
  cardIds: FIRST_EXPEDITION_ENCOUNTER_CARDS.map((card) => card.id),
  directionIds: [...ENCOUNTER_DIRECTIONS],
  initialDelay: { minSeconds: 12, maxSeconds: 18 },
  interval: { minSeconds: 18, maxSeconds: 28 },
  retryDelaySeconds: 2,
};
