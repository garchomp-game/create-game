export const CONCEPT_IDS = ["tactical", "recovery", "arcade"] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];
export type ConceptSelection = "compare" | ConceptId;

export const SCREEN_IDS = ["title", "stage", "upgrade", "combat", "result"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];
export type PrototypeViewport = "landscape" | "portrait";

export type ConceptDefinition = {
  id: ConceptId;
  index: string;
  label: string;
  shortLabel: string;
  systemLabel: string;
  stageVerb: string;
  primaryAction: string;
};

export type StageDefinition = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  difficulty: string;
  duration: string;
  enemyTypes: string[];
  objective: string;
  status: "cleared" | "available" | "locked";
};

export type UpgradeDefinition = {
  id: string;
  category: string;
  title: string;
  description: string;
  rank: string;
  metric: string;
  accent: "pulse" | "mobility" | "survival";
};

export type PrototypeData = {
  productName: string;
  tagline: string;
  runLabel: string;
  stages: StageDefinition[];
  upgrades: UpgradeDefinition[];
  combat: {
    hp: number;
    maxHp: number;
    xp: number;
    xpToNext: number;
    level: number;
    elapsed: string;
    score: number;
    threat: number;
    enemies: number;
    weapon: string;
    bossHp: number;
    bossMaxHp: number;
    bossPhase: number;
    event: string;
  };
  result: {
    score: number;
    elapsed: string;
    clearBonus: number;
    timeBonus: number;
    bossTime: string;
    level: number;
    kills: number;
    damageTaken: number;
    rank: string;
    build: string[];
  };
};

export type PrototypeState = {
  concept: ConceptSelection;
  screen: ScreenId;
  viewport: PrototypeViewport;
  selectedStageId: string;
  selectedUpgradeId: string;
  capture: boolean;
};
