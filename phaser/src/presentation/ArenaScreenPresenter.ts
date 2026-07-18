import type { MenuAction, SecondaryMenu } from "../application/ArenaMenuTypes";
import { APP_VERSION, RELEASE_CHANNEL_LABEL } from "../config/version";
import type { GameStatus, SimulationConfig, WorldState } from "../domain/types";
import { TEXT } from "../lang";
import { getUpgradeRequirementProgress } from "../simulation/buildComposer";
import { createArenaResultViewModel } from "./ArenaResultPresenter";
import {
  createArenaMenuLabels,
  createArenaSecondaryMenuViewModel,
} from "./ArenaSecondaryMenuPresenter";
import type { ArenaUiState } from "./ArenaUiState";

export type ArenaScreenKind =
  | "none"
  | "history"
  | "ranking"
  | "settings"
  | "gameOver"
  | "upgradeSelect"
  | "contractSelect"
  | "paused"
  | "weaponSelect"
  | "title";

export type ArenaScreenViewModel = {
  kind: ArenaScreenKind;
  status: GameStatus;
  secondaryMenu: SecondaryMenu | null;
  statusText: string | null;
  detailText: string | null;
  menuLabels: Partial<Record<MenuAction, string>>;
  focusedMenuAction: MenuAction | null;
};

export function createArenaScreenViewModel(
  world: WorldState,
  simulationConfig: SimulationConfig,
  uiState?: ArenaUiState,
): ArenaScreenViewModel {
  const secondaryMenu = uiState?.secondaryMenu ?? null;
  const base = {
    status: world.state.status,
    secondaryMenu,
    menuLabels: createArenaMenuLabels(uiState),
    focusedMenuAction: uiState?.focusedMenuAction ?? null,
  };

  if (secondaryMenu !== null) {
    const menu = createArenaSecondaryMenuViewModel(secondaryMenu, uiState!);
    return {
      ...base,
      kind: menu.kind,
      statusText: menu.statusText,
      detailText: null,
    };
  }

  switch (world.state.status) {
    case "gameOver": {
      const result = createArenaResultViewModel(world, uiState);
      return {
        ...base,
        kind: "gameOver",
        statusText: result.statusText,
        detailText: result.detailText,
      };
    }
    case "upgradeSelect":
      return { ...base, kind: "upgradeSelect", statusText: null, detailText: null };
    case "contractSelect":
      return { ...base, kind: "contractSelect", statusText: null, detailText: null };
    case "paused":
      return {
        ...base,
        kind: "paused",
        statusText: TEXT.ui.paused,
        detailText: `${TEXT.hud.weaponNames[world.state.weaponType]}\n${formatCapstoneProgress(world, simulationConfig)}\n${formatRecentSelections(world)}`,
      };
    case "weaponSelect":
      return { ...base, kind: "weaponSelect", statusText: null, detailText: null };
    case "title":
      return {
        ...base,
        kind: "title",
        statusText: `${TEXT.ui.titleScreen}\nENDLESS / EXPEDITION\n生存限界か、最終決戦か\n${RELEASE_CHANNEL_LABEL} v${uiState?.releaseIdentity.appVersion ?? APP_VERSION}`,
        detailText: null,
      };
    default:
      return { ...base, kind: "none", statusText: null, detailText: null };
  }
}

function formatCapstoneProgress(world: WorldState, simulationConfig: SimulationConfig): string {
  const capstoneId =
    world.state.weaponType === "pulse"
      ? "pulseRicochet"
      : world.state.weaponType === "spread"
        ? "spreadSweep"
        : null;
  if (
    capstoneId === null ||
    (capstoneId === "pulseRicochet" && !simulationConfig.features.pulseRicochet) ||
    (capstoneId === "spreadSweep" && !simulationConfig.features.spreadSweep)
  ) {
    return "最終強化: この武器では未実装";
  }
  const title = TEXT.upgrades.definitions[capstoneId].title;
  if (world.progression.upgradeRanks[capstoneId] > 0) {
    return TEXT.upgrades.capstoneAcquired(title);
  }
  const progress = getUpgradeRequirementProgress(
    simulationConfig,
    capstoneId,
    world.progression.upgradeRanks,
  )[0];
  return progress
    ? TEXT.upgrades.capstoneProgress(progress.current, progress.required)
    : "最終強化: 条件なし";
}

function formatRecentSelections(world: WorldState): string {
  const extraSelections = world.stats.progressionMetrics.extraSelections.slice(-3);
  if (extraSelections.length > 0) {
    return `直近: ${extraSelections
      .map(
        (selection) =>
          `${TEXT.upgrades.extraDefinitions[selection.extraUpgradeId].title}${selection.rank}`,
      )
      .join(" / ")}`;
  }
  const selections = world.stats.progressionMetrics.selections.slice(-3);
  if (selections.length === 0) return "選択履歴: まだなし";
  return `直近: ${selections
    .map(
      (selection) => `${TEXT.upgrades.definitions[selection.upgradeId].title}${selection.rank}`,
    )
    .join(" / ")}`;
}
