import { FINAL_EXPEDITION_ENCOUNTER_CARDS } from "../content/expeditionEncounterCards";
import type {
  EncounterCardDefinition,
  EncounterDirection,
} from "../domain/encounterDirector";
import type { SimulationConfig, WorldState } from "../domain/types";
import { TEXT } from "../lang";
import { getDifficultyElapsed } from "../simulation/difficultyClock";
import { getNextCollapseAt } from "../simulation/systems/collapseSystem";
import { createEndlessWaveCueViewModel } from "./EndlessWaveCuePresenter";

export type TacticalStatusTone =
  | "objective"
  | "warning"
  | "danger"
  | "recovery";

export type TacticalStatusViewModel = {
  tone: TacticalStatusTone;
  title: string;
  detail: string | null;
  expanded: boolean;
  remainingRatio: number | null;
};

const ACT_DETAIL_SECONDS = 3;
const EXPEDITION_CARDS = new Map<string, EncounterCardDefinition>(
  FINAL_EXPEDITION_ENCOUNTER_CARDS.map((card) => [card.id, card]),
);

export function createTacticalStatusViewModel(
  world: WorldState,
  config: SimulationConfig,
): TacticalStatusViewModel | null {
  if (world.expedition) return createExpeditionStatus(world);
  return createEndlessStatus(world, config);
}

function createExpeditionStatus(
  world: WorldState,
): TacticalStatusViewModel | null {
  const expedition = world.expedition;
  if (!expedition || expedition.boss?.status === "active") return null;

  const director = expedition.director;
  const card = director.cardId ? EXPEDITION_CARDS.get(director.cardId) : null;
  const cardLabel = formatExpeditionCard(expedition.currentCardTitleKey);
  const directionLabel = formatExpeditionDirection(expedition.currentDirection);

  if (card && director.phase === "telegraph" && director.selectedAt !== null) {
    const remaining = Math.max(
      0,
      director.selectedAt + card.timing.telegraphSeconds - world.state.elapsed,
    );
    return timedStatus(
      "warning",
      `${directionLabel} · ${cardLabel}`,
      `侵入予告 ${formatSeconds(remaining)}`,
      remaining,
      card.timing.telegraphSeconds,
      true,
    );
  }

  if (card && director.phase === "deploying") {
    const deadline = director.deploymentDeadlineAt;
    const remaining =
      deadline === null ? null : Math.max(0, deadline - world.state.elapsed);
    return {
      tone: "warning",
      title: `${directionLabel} · ${cardLabel}`,
      detail:
        remaining === null
          ? "展開位置を確認中"
          : `展開待機 ${formatSeconds(remaining)}`,
      expanded: true,
      remainingRatio:
        remaining === null || !card.deployment
          ? null
          : clampRatio(remaining / card.deployment.timeoutSeconds),
    };
  }

  if (card && director.phase === "active") {
    const commander = world.enemies.find(
      (enemy) => enemy.elite?.kind === "commander",
    );
    if (commander?.elite) {
      const maximumHp = commander.elite.maximumHp;
      return {
        tone: "danger",
        title: `指揮個体 HP ${Math.ceil(commander.hp)} / ${maximumHp}`,
        detail: `${cardLabel} · 撃破して増援を止める`,
        expanded: true,
        remainingRatio:
          maximumHp > 0 ? clampRatio(commander.hp / maximumHp) : null,
      };
    }

    const duration = card.activeTimeoutSeconds ?? card.timing.activeSeconds;
    const elapsed = Math.max(
      0,
      director.activeStartedAt === null
        ? director.activeElapsed
        : world.state.elapsed - director.activeStartedAt,
    );
    const remaining = Math.max(0, duration - elapsed);
    return timedStatus(
      "danger",
      `${cardLabel} · 交戦 ${formatSeconds(remaining)}`,
      null,
      remaining,
      duration,
      false,
    );
  }

  if (
    card &&
    director.phase === "recovery" &&
    director.recoveryStartedAt !== null
  ) {
    const remaining = Math.max(
      0,
      director.recoveryStartedAt +
        card.timing.recoverySeconds -
        world.state.elapsed,
    );
    return timedStatus(
      "recovery",
      `再編 ${formatSeconds(remaining)} · ${cardLabel}`,
      null,
      remaining,
      card.timing.recoverySeconds,
      false,
    );
  }

  const showActDetail =
    world.state.elapsed - expedition.actStartedAt < ACT_DETAIL_SECONDS;
  return {
    tone: "objective",
    title: formatExpeditionAct(expedition.actId),
    detail: showActDetail ? expedition.objective : null,
    expanded: showActDetail,
    remainingRatio: null,
  };
}

function createEndlessStatus(
  world: WorldState,
  config: SimulationConfig,
): TacticalStatusViewModel | null {
  if (config.features.arenaCollapse) {
    const nextAt = getNextCollapseAt(config, world.encounter.collapse.stage);
    const untilNext = nextAt - world.state.elapsed;
    if (
      untilNext >= 0 &&
      untilNext <= config.encounter.collapse.warningDuration
    ) {
      return timedStatus(
        "danger",
        "アリーナ崩壊",
        `安全領域縮小まで ${formatSeconds(untilNext)}`,
        untilNext,
        config.encounter.collapse.warningDuration,
        true,
      );
    }
  }

  const director = world.encounter.director;
  const scheduledAt = director.scheduledAt;
  const encounterId = director.currentId;
  if (scheduledAt !== null && encounterId !== null) {
    const definition = config.encounter.director.definitions[encounterId];
    const encounterName = TEXT.hud.encounterNames[encounterId];
    if (director.phase === "warning") {
      const remaining = Math.max(0, scheduledAt - world.state.elapsed);
      return timedStatus(
        "warning",
        encounterName,
        `危険開始まで ${formatSeconds(remaining)}`,
        remaining,
        definition.warningDuration,
        true,
      );
    }
    if (director.phase === "active") {
      const remaining = Math.max(
        0,
        scheduledAt + definition.activeDuration - world.state.elapsed,
      );
      return timedStatus(
        "danger",
        `${encounterName} · 交戦 ${formatSeconds(remaining)}`,
        null,
        remaining,
        definition.activeDuration,
        false,
      );
    }
    if (director.phase === "recovery") {
      const remaining = Math.max(
        0,
        scheduledAt +
          definition.activeDuration +
          definition.recoveryDuration -
          world.state.elapsed,
      );
      return timedStatus(
        "recovery",
        `再編 ${formatSeconds(remaining)} · ${encounterName}`,
        null,
        remaining,
        definition.recoveryDuration,
        false,
      );
    }
  }

  if (config.features.arenaCollapse && world.encounter.collapse.stage > 0) {
    return {
      tone: "danger",
      title: TEXT.hud.collapseActive(world.encounter.collapse.stage),
      detail: null,
      expanded: false,
      remainingRatio: null,
    };
  }

  if (!world.practice) {
    const cue = createEndlessWaveCueViewModel(
      config,
      getDifficultyElapsed(world),
    );
    if (cue) {
      return {
        tone:
          cue.kind === "warning"
            ? "warning"
            : cue.kind === "relief"
              ? "recovery"
              : "danger",
        title: cue.text,
        detail: null,
        expanded: false,
        remainingRatio: null,
      };
    }
  }

  if (world.encounter.contract.choice === "overdrive") {
    return {
      tone: "warning",
      title: TEXT.hud.overdriveContract,
      detail: null,
      expanded: false,
      remainingRatio: null,
    };
  }
  return null;
}

function timedStatus(
  tone: TacticalStatusTone,
  title: string,
  detail: string | null,
  remaining: number,
  duration: number,
  expanded: boolean,
): TacticalStatusViewModel {
  return {
    tone,
    title,
    detail,
    expanded,
    remainingRatio: duration > 0 ? clampRatio(remaining / duration) : null,
  };
}

function formatExpeditionAct(actId: string): string {
  const labels: Record<string, string> = {
    "perimeter-watch": "ACT 1 · 四方警戒",
    "first-assault": "ACT 2 · 重装襲来",
    counterattack: "ACT 3 · 反撃",
    breakthrough: "ACT 4 · 包囲突破",
    "command-ship": "ACT 5 · 最終決戦",
  };
  return labels[actId] ?? actId;
}

function formatExpeditionCard(titleKey: string | null): string {
  if (!titleKey) return "次の遭遇";
  const labels: Record<string, string> = {
    "encounter.vanguard-arc.title": "前衛弧状波",
    "encounter.crossfire-pincer.title": "十字挟撃",
    "encounter.heavy-escort.title": "重装護衛隊",
    "encounter.commander-counterattack.title": "指揮個体反撃",
    "encounter.charger-breakthrough.title": "突撃突破隊",
    "encounter.command-ship-showdown.title": "敵指揮艦決戦",
  };
  return labels[titleKey] ?? titleKey;
}

function formatExpeditionDirection(
  direction: EncounterDirection | null,
): string {
  const labels: Record<EncounterDirection, string> = {
    north: "北 ↑",
    east: "東 →",
    south: "南 ↓",
    west: "西 ←",
  };
  return direction ? labels[direction] : "外周";
}

function formatSeconds(seconds: number): string {
  return `${Math.max(0, Math.ceil(seconds))}秒`;
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}
