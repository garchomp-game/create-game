import {
  createRankEligibility,
  createRunRecord,
} from "../application/runRecords";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import {
  APP_VERSION,
  ENDLESS_RULESET_VERSION,
} from "../config/version";
import { createDefaultPracticeRunOptions } from "../domain/practice";
import { createDefaultProfileSettings } from "../domain/profile";
import type { Enemy, WorldState } from "../domain/types";
import { formatTime } from "../format/time";
import { TEXT } from "../lang";
import {
  createArenaChoiceViewModel,
  type ArenaChoiceViewModel,
} from "../presentation/ArenaChoicePresenter";
import {
  createArenaScreenViewModel,
  type ArenaScreenViewModel,
} from "../presentation/ArenaScreenPresenter";
import type { ArenaUiState } from "../presentation/ArenaUiState";
import type { UiScreenId } from "../presentation/UiScreenCatalog";
import { getDifficultyElapsed } from "../simulation/difficultyClock";
import { createWorld } from "../simulation/createWorld";
import { createRunResultSummary } from "../simulation/resultSummary";
import { getPlayerEffectiveMaxHp } from "../simulation/systems/playerHealthSystem";
import { getThreatTier } from "../simulation/threatDirector";
import { getWaveBand } from "../simulation/waveDirector";

export type UiCatalogHudViewModel = {
  hp: { label: string; value: string; ratio: number };
  xp: { label: string; value: string; ratio: number };
  meta: string;
  weaponStatus: string;
  weaponName: string;
  helpLabel: string;
  arena: {
    player: { x: number; y: number };
    enemies: ReadonlyArray<{ x: number; y: number; typeId: Enemy["typeId"] }>;
  };
};

export type UiCatalogFixture =
  | {
      kind: "title";
      screenId: "title";
      source: "ArenaScreenViewModel";
      model: ArenaScreenViewModel;
    }
  | {
      kind: "choice";
      screenId: "upgrade-select";
      source: "ArenaChoiceViewModel";
      model: ArenaChoiceViewModel;
    }
  | {
      kind: "hud";
      screenId: "gameplay-standard";
      source: "WorldState + production formatters";
      model: UiCatalogHudViewModel;
    }
  | {
      kind: "result";
      screenId: "result-endless";
      source: "ArenaScreenViewModel";
      model: ArenaScreenViewModel;
    };

export function createUiCatalogFixture(
  screenId: UiScreenId,
): UiCatalogFixture | null {
  switch (screenId) {
    case "title":
      return createTitleFixture();
    case "upgrade-select":
      return createChoiceFixture();
    case "gameplay-standard":
      return createHudFixture();
    case "result-endless":
      return createResultFixture();
    default:
      return null;
  }
}

function createTitleFixture(): UiCatalogFixture {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.status = "title";
  return {
    kind: "title",
    screenId: "title",
    source: "ArenaScreenViewModel",
    model: createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createCatalogUiState(),
    ),
  };
}

function createChoiceFixture(): UiCatalogFixture {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.status = "upgradeSelect";
  world.state.weaponType = "pulse";
  world.progression.level = 4;
  world.progression.pendingUpgradeChoices = [
    "rapidFire",
    "swiftStep",
    "vitalCore",
  ];
  world.progression.upgradeRanks.rapidFire = 1;

  return {
    kind: "choice",
    screenId: "upgrade-select",
    source: "ArenaChoiceViewModel",
    model: createArenaChoiceViewModel(world, SIMULATION_CONFIG),
  };
}

function createHudFixture(): UiCatalogFixture {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.elapsed = 142.4;
  world.state.score = 18_420;
  world.state.hp = 63;
  world.state.weaponType = "pulse";
  world.progression.level = 9;
  world.progression.xp = 52;
  world.progression.xpToNext = 72;
  world.enemies = CATALOG_ENEMY_POSITIONS.map((position, index) =>
    createCatalogEnemy(index, position),
  );

  const maxHp = getPlayerEffectiveMaxHp(world, SIMULATION_CONFIG);
  const difficultyElapsed = getDifficultyElapsed(world);
  const wave = getWaveBand(SIMULATION_CONFIG, difficultyElapsed);
  const threatTier = getThreatTier(SIMULATION_CONFIG, difficultyElapsed);

  return {
    kind: "hud",
    screenId: "gameplay-standard",
    source: "WorldState + production formatters",
    model: {
      hp: {
        label: TEXT.hud.hpLabel,
        value: TEXT.hud.hpValue(Math.ceil(world.state.hp), maxHp),
        ratio: world.state.hp / maxHp,
      },
      xp: {
        label: TEXT.hud.levelLabel(world.progression.level),
        value: TEXT.hud.experienceValue(
          world.progression.xp,
          world.progression.xpToNext,
        ),
        ratio: world.progression.xp / world.progression.xpToNext,
      },
      meta: TEXT.hud.meta(formatTime(world.state.elapsed), world.state.score),
      weaponStatus: TEXT.hud.danger(
        threatTier,
        world.enemies.length,
        wave.maxEnemies,
        TEXT.hud.weaponNames[world.state.weaponType],
      ),
      weaponName: TEXT.hud.weaponNames[world.state.weaponType],
      helpLabel: "?",
      arena: {
        player: { x: 480, y: 300 },
        enemies: world.enemies.map((enemy) => ({
          x: enemy.position.x,
          y: enemy.position.y,
          typeId: enemy.typeId,
        })),
      },
    },
  };
}

function createResultFixture(): UiCatalogFixture {
  const world = createWorld(SIMULATION_CONFIG);
  world.state.status = "gameOver";
  world.state.elapsed = 246.78;
  world.state.score = 38_420;
  world.state.hp = 0;
  world.state.weaponType = "pulse";
  world.progression.level = 12;
  world.progression.extraLevel = 2;
  world.progression.extraCycle = 1;
  world.stats.shotsFired = 1_870;
  world.stats.enemiesKilled = 654;
  world.stats.hitsTaken = 42;
  world.stats.damageTaken = 412;
  world.stats.damageTakenBySource.projectile = 168;
  world.stats.damageTakenBySource.contact = 244;
  world.stats.hpRecovered = 312;
  world.stats.healPickupsCollected = 31;
  world.stats.effectiveHealPickupsCollected = 26;
  world.stats.lastDamageSource = {
    kind: "projectile",
    projectileId: "catalog-projectile-1",
  };

  const record = createRunRecord({
    context: {
      id: "run-ui-catalog",
      profileId: CATALOG_PROFILE_ID,
      startedAt: "2026-07-25T00:00:00.000Z",
      modeId: "endless",
      stageId: "arena-default",
      difficultyId: "standard",
      rulesetVersion: ENDLESS_RULESET_VERSION,
      rulesetProfileId: "legacy-endless-v068",
      rngVersion: "arena-rng-v1",
      runRecordSchemaVersion: 2,
      exProtocolsEnabled: false,
      seedCategory: "random",
      weaponId: world.state.weaponType,
      modifierIds: [],
      appVersion: APP_VERSION,
      buildCommit: "catalogfixture",
      seed: 20_260_725,
      runOrigin: "manual",
      rankEligibility: createRankEligibility("manual"),
    },
    capturedAt: "2026-07-25T00:05:00.000Z",
    summary: createRunResultSummary(world),
    upgradeRanks: world.progression.upgradeRanks,
    upgradeSelections: world.stats.progressionMetrics.selections,
    extraUpgradeRanks: world.progression.extraUpgradeRanks,
    extraUpgradeSelections: world.stats.progressionMetrics.extraSelections,
    buildCompletedAt: world.progression.buildCompletedAt,
    encounterMetrics: world.stats.encounterMetrics,
  });

  return {
    kind: "result",
    screenId: "result-endless",
    source: "ArenaScreenViewModel",
    model: createArenaScreenViewModel(
      world,
      SIMULATION_CONFIG,
      createCatalogUiState({ latestRunRecord: record }),
    ),
  };
}

function createCatalogUiState(
  overrides: Partial<ArenaUiState> = {},
): ArenaUiState {
  return {
    secondaryMenu: null,
    helpPage: "controls",
    records: [],
    ranking: [],
    rankingQuery: null,
    rankingBoardIndex: 0,
    rankingBoardCount: 0,
    profile: {
      schemaVersion: 1,
      id: CATALOG_PROFILE_ID,
      displayName: "カタログ用ゲスト",
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
    },
    settings: createDefaultProfileSettings(),
    practiceOptions: createDefaultPracticeRunOptions(),
    latestRunRecord: null,
    previousBest: null,
    previousWeaponBest: null,
    historyClearPending: false,
    rankingClearPending: false,
    historyPage: 0,
    historyWeaponFilter: "all",
    focusedMenuAction: null,
    notice: null,
    releaseIdentity: {
      appVersion: APP_VERSION,
      rulesetVersion: ENDLESS_RULESET_VERSION,
      buildCommit: "catalogfixture",
    },
    ...overrides,
  };
}

function createCatalogEnemy(
  index: number,
  position: (typeof CATALOG_ENEMY_POSITIONS)[number],
): Enemy {
  const typeId = CATALOG_ENEMY_TYPES[index % CATALOG_ENEMY_TYPES.length]!;
  const definition = SIMULATION_CONFIG.enemies[typeId];
  return {
    id: `catalog-enemy-${index + 1}`,
    typeId,
    position: { ...position },
    radius: definition.radius,
    hp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    score: definition.score,
    xpValue: definition.xpValue,
    behavior: definition.behavior,
    attackTimer: 0,
    enteredArena: true,
  };
}

const CATALOG_PROFILE_ID = "00000000-0000-4000-8000-000000000035";
const CATALOG_ENEMY_TYPES = [
  "chaser",
  "brute",
  "fast",
  "ranged",
] as const;
const CATALOG_ENEMY_POSITIONS = [
  { x: 110, y: 168 },
  { x: 185, y: 420 },
  { x: 286, y: 112 },
  { x: 354, y: 444 },
  { x: 436, y: 142 },
  { x: 522, y: 430 },
  { x: 608, y: 124 },
  { x: 690, y: 406 },
  { x: 782, y: 160 },
  { x: 862, y: 352 },
  { x: 138, y: 294 },
  { x: 258, y: 332 },
  { x: 382, y: 248 },
  { x: 596, y: 270 },
  { x: 714, y: 302 },
  { x: 832, y: 250 },
  { x: 474, y: 462 },
] as const;
