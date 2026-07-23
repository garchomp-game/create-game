import {
  EX_PROTOCOL_CATALOG,
  getExProtocolDefinition,
} from "../content/exProtocolCatalog";
import type { ExProtocolRecordStats } from "../domain/runRecords";
import type {
  ExProtocolEvolutionId,
  ExProtocolId,
} from "../domain/exProtocols";
import type {
  ActiveVolleyAnalytics,
  GameEvent,
  SimulationConfig,
  WorldState,
} from "../domain/types";
import { getPlayerCapacity } from "../simulation/systems/playerHealthSystem";

export type ExProtocolChoiceFactViewModel = {
  label: "発動条件" | "効果" | "制約";
  text: string;
};

export type ExProtocolChoiceCardViewModel = {
  id: string;
  role: string;
  title: string;
  summary: string;
  facts: ExProtocolChoiceFactViewModel[];
  inputHint: string | null;
  ariaLabel: string;
};

export type ExProtocolChoiceViewModel = {
  kind: "protocol" | "evolution";
  title: string;
  subtitle: string;
  footer: string | null;
  cards: ExProtocolChoiceCardViewModel[];
};

export type ExProtocolHudViewModel = {
  name: string;
  exLevel: number;
  routeLabel: string;
  primary: string;
  secondary: string;
  accent: number;
};

const [
  resonanceRelay,
  reboundOverdrive,
  redlineCore,
  fullSpanTidalSweep,
  breakwaterFan,
  aegisFan,
] = EX_PROTOCOL_CATALOG.protocols;

export function createExProtocolChoiceViewModel(
  world: WorldState,
): ExProtocolChoiceViewModel | null {
  const pending = world.progression.pendingChoice;
  if (
    world.state.status === "protocolSelect" &&
    pending?.kind === "protocol"
  ) {
    return {
      kind: "protocol",
      title: "EX Lv 0 / 固有能力を選択",
      subtitle: "通常ビルドへ追加する能力を1つ選択",
      footer: "1 / 2 / 3 で選択",
      cards: pending.choices.map(createProtocolCard),
    };
  }
  if (
    world.state.status === "evolutionSelect" &&
    (pending?.kind === "evolution-one" ||
      pending?.kind === "evolution-two")
  ) {
    const definition = requireProtocol(pending.protocolId);
    const tier = pending.kind === "evolution-one" ? 1 : 2;
    return {
      kind: "evolution",
      title: `${formatProtocolName(definition)} / EVOLUTION ${tier === 1 ? "I" : "II"}`,
      subtitle: `CURRENT: ${formatCurrentSignature(world, pending.protocolId)}`,
      footer:
        tier === 2
          ? `選択後に MASTERY 自動解禁: ${definition.mastery.displayNameJa} / ${definition.mastery.displayNameEn} - ${formatMasteryEffect(pending.protocolId)}`
          : "1 / 2 で進化先を選択",
      cards: pending.choices.map((choiceId) =>
        createEvolutionCard(pending.protocolId, tier, choiceId),
      ),
    };
  }
  return null;
}

export function createExProtocolHudViewModel(
  world: WorldState,
  config: SimulationConfig,
): ExProtocolHudViewModel | null {
  if (!config.features.exProtocols) return null;
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return null;

  const definition = requireProtocol(progression.route.protocolId);
  const base = {
    name: definition.displayNameJa,
    exLevel: world.progression.extraLevel,
    routeLabel: formatRouteLabel(world),
    accent: definition.weaponId === "pulse" ? 0x22d3ee : 0xfbbf24,
  };
  const runtime = progression.runtime;
  if (runtime.kind === "resonance-relay") {
    const remaining = runtime.anchor
      ? Math.max(0, runtime.anchor.expiresAt - world.state.elapsed)
      : 0;
    return {
      ...base,
      primary: runtime.anchor
        ? `記録 ${formatTenths(remaining)}`
        : "集束MAXで記録",
      secondary: runtime.anchor
        ? "別の敵へ当てると連鎖"
        : "同じ敵へ連続命中",
    };
  }
  if (runtime.kind === "rebound-overdrive") {
    const armedRemaining =
      runtime.armedUntil === null
        ? 0
        : Math.max(0, runtime.armedUntil - world.state.elapsed);
    const cooldownRemaining = Math.max(
      0,
      runtime.cooldownUntil - world.state.elapsed,
    );
    return {
      ...base,
      primary:
        armedRemaining > 0
          ? `武装 ${formatTenths(armedRemaining)}`
          : cooldownRemaining <= 0
            ? "発動可能  [RMB / E]"
            : `再装填 ${formatTenths(cooldownRemaining)}`,
      secondary:
        armedRemaining > 0 && cooldownRemaining > 0
          ? `再装填 ${formatTenths(cooldownRemaining)}`
          : "次の通常射撃を反射武装",
    };
  }
  if (runtime.kind === "redline-core") {
    const capacity = getPlayerCapacity(world, config);
    const ratio =
      capacity.grossMaxHp > 0
        ? Math.round((capacity.reservedHp / capacity.grossMaxHp) * 100)
        : 0;
    return {
      ...base,
      primary: "稼働中",
      secondary: `集束MAX命中を強化 / 最大HP -${ratio}%`,
    };
  }
  if (runtime.kind === "full-span-tidal-sweep") {
    const maximumCharges =
      progression.route.evolutionTwoId ===
      fullSpanTidalSweep.evolutionTwo[0].id
        ? fullSpanTidalSweep.evolutionTwo[0].maxCharges
        : fullSpanTidalSweep.signature.maxCharges;
    const capture = getLatestVolley(world)?.tidalEnemyIds?.length ?? 0;
    return {
      ...base,
      primary:
        runtime.charges > 0
          ? `発動可能  [RMB / E]  CHARGE ${runtime.charges}/${maximumCharges}`
          : `CHARGE ${runtime.charges}/${maximumCharges}`,
      secondary: `捕捉 ${Math.min(capture, fullSpanTidalSweep.signature.chargeDistinctTargets)}/${fullSpanTidalSweep.signature.chargeDistinctTargets}`,
    };
  }
  if (runtime.kind === "breakwater-fan") {
    const cooldownRemaining = Math.max(
      0,
      runtime.cooldownUntil - world.state.elapsed,
    );
    const efficientVenting = breakwaterFan.evolutionOne[0];
    const costRatio =
      progression.route.evolutionOneId === efficientVenting.id
        ? efficientVenting.costGrossHpSnapshotRatio
        : breakwaterFan.signature.costGrossHpSnapshotRatio;
    const hpCost = Math.ceil(runtime.grossMaxHpAtSelection * costRatio);
    const canPay =
      world.state.hp - hpCost >= breakwaterFan.signature.minimumHpAfterCost;
    const ready = runtime.charges > 0 && cooldownRemaining <= 0 && canPay;
    const capture =
      getLatestVolley(world)?.breakwaterCloseEnemyIds?.length ?? 0;
    return {
      ...base,
      primary: ready
        ? `発動可能  [RMB / E]  HP -${hpCost}`
        : !canPay && runtime.charges > 0 && cooldownRemaining <= 0
          ? "HP不足"
          : `CHARGE ${runtime.charges}/${breakwaterFan.signature.maxCharges}`,
      secondary: [
        cooldownRemaining > 0
          ? `再装填 ${formatTenths(cooldownRemaining)}`
          : null,
        `捕捉 ${Math.min(capture, breakwaterFan.signature.chargeDistinctTargets)}/${breakwaterFan.signature.chargeDistinctTargets}`,
      ]
        .filter(Boolean)
        .join(" / "),
    };
  }
  return {
    ...base,
    primary: "自動迎撃",
    secondary: progression.route.masteryUnlocked
      ? `完全防護 ${runtime.perfectGuardCharges}/${aegisFan.mastery.maxCharges}`
      : "左右端の弾が通常敵弾を消す",
  };
}

export function formatSelectedExProtocolRoute(world: WorldState): string {
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return "PROTOCOL 未選択";
  const definition = requireProtocol(progression.route.protocolId);
  return `${formatProtocolName(definition)} / ${formatRouteLabel(world)}`;
}

export function formatExProtocolRecordRoute(
  record: ExProtocolRecordStats | null,
): string {
  if (!record?.selectedId) return "";
  const definition = requireProtocol(record.selectedId);
  const evolutionOne = definition.evolutionOne.find(
    ({ id }) => id === record.evolutionOneId,
  );
  const evolutionTwo = definition.evolutionTwo.find(
    ({ id }) => id === record.evolutionTwoId,
  );
  const route = [
    evolutionOne
      ? `E1 ${evolutionOne.displayNameJa}`
      : "E1 未到達",
    evolutionTwo
      ? `E2 ${evolutionTwo.displayNameJa}`
      : "E2 未到達",
    record.masteryId
      ? `MASTERY ${definition.mastery.displayNameJa}`
      : "MASTERY 未解禁",
  ].join(" / ");
  return `PROTOCOL: ${formatProtocolName(definition)}\n進化経路: ${route}`;
}

export function formatExProtocolEventNotice(event: GameEvent): string | null {
  if (event.type === "ex.mastery.unlocked") {
    const definition = requireProtocol(event.protocolId);
    return `MASTERY 解禁: ${definition.mastery.displayNameJa}`;
  }
  if (event.type === "ex.limit_break.connected") {
    return "LIMIT BREAK 接続";
  }
  if (event.type === "ex.relay.blocked") {
    return "導線遮断";
  }
  if (event.type === "ex.special.rejected") {
    const labels = {
      "already-armed": "すでに武装中",
      cooldown: "再装填中",
      "not-charged": "CHARGE不足",
      "insufficient-hp": "HP不足",
    } as const;
    return labels[event.reason];
  }
  if (
    event.type === "ex.tidal.charged" ||
    event.type === "ex.breakwater.charged"
  ) {
    return "CHARGE READY";
  }
  if (event.type === "ex.special.armed") {
    return "反跳過給 武装";
  }
  if (event.type === "ex.special.activated") {
    const definition = requireProtocol(event.protocolId);
    return `${definition.displayNameJa} 発動`;
  }
  if (event.type === "ex.aegis.perfect-guard.charged") {
    return "完全防護 READY";
  }
  return null;
}

function createProtocolCard(
  protocolId: ExProtocolId,
): ExProtocolChoiceCardViewModel {
  const definition = requireProtocol(protocolId);
  const copy = getProtocolCopy(protocolId);
  const title = formatProtocolName(definition);
  return {
    id: protocolId,
    role: copy.role,
    title,
    summary: copy.summary,
    facts: copy.facts,
    inputHint:
      definition.interaction === "active" ? "RMB / E で発動" : null,
    ariaLabel: [
      title,
      copy.role,
      ...copy.facts.map((fact) => `${fact.label}: ${fact.text}`),
    ].join("。"),
  };
}

function createEvolutionCard(
  protocolId: ExProtocolId,
  tier: 1 | 2,
  evolutionId: ExProtocolEvolutionId,
): ExProtocolChoiceCardViewModel {
  const definition = requireProtocol(protocolId);
  const options =
    tier === 1 ? definition.evolutionOne : definition.evolutionTwo;
  const option = options.find((candidate) => candidate.id === evolutionId);
  if (!option) {
    throw new Error(
      `Unknown Evolution ${tier} "${evolutionId}" for "${protocolId}".`,
    );
  }
  const effect = formatEvolutionEffect(protocolId, tier, evolutionId);
  const title = `${option.displayNameJa} / ${option.displayNameEn}`;
  return {
    id: evolutionId,
    role: `${definition.displayNameJa} / EVOLUTION ${tier === 1 ? "I" : "II"}`,
    title,
    summary: effect,
    facts: [{ label: "効果", text: effect }],
    inputHint: null,
    ariaLabel: `${title}。EFFECT: ${effect}`,
  };
}

function getProtocolCopy(
  protocolId: ExProtocolId,
): Pick<ExProtocolChoiceCardViewModel, "role" | "summary" | "facts"> {
  if (protocolId === resonanceRelay.id) {
    return {
      role: "自動 / 集束連鎖",
      summary: "集束MAXの地点と次に撃った敵を結び、間の敵へ連鎖する。",
      facts: [
        {
          label: "発動条件",
          text: `同じ敵への連続命中で集束MAXにすると、その場所を${resonanceRelay.signature.anchorLifetimeSeconds}秒記録。時間内に別の敵へ通常Pulse弾を当てる。倒した敵の場所も記録する。`,
        },
        {
          label: "効果",
          text: `記録地点と次の敵の間にいる最大${resonanceRelay.signature.maxIntermediateTargets}体へ、通常弾の${formatPercent(resonanceRelay.signature.damageMultiplier)}ダメージ。`,
        },
        {
          label: "制約",
          text: "障害物で遮断される。同じ射撃内では発動せず、発動すると記録と元の敵の集束を消費する。",
        },
      ],
    };
  }
  if (protocolId === reboundOverdrive.id) {
    return {
      role: "手動 / 反射弾強化",
      summary: "次の1射を強化し、跳ね返った瞬間にその弾の貫通力を戻す。",
      facts: [
        {
          label: "発動条件",
          text: `RMB / Eを押し、${reboundOverdrive.signature.armDurationSeconds}秒以内に通常Pulse弾を撃つ。その弾を壁か障害物で跳ね返す。`,
        },
        {
          label: "効果",
          text: "最初に跳ね返った瞬間、その弾の残り貫通回数を発射時の値まで戻す。",
        },
        {
          label: "制約",
          text: `${reboundOverdrive.signature.cooldownSeconds}秒間は再使用できない。時間切れ・空振り・未反射でも待ち時間は発生する。`,
        },
      ],
    };
  }
  if (protocolId === redlineCore.id) {
    return {
      role: "自動 / HP交換火力",
      summary: "最大HPを減らす代わりに、集束MAXになる命中を高火力化する。",
      facts: [
        {
          label: "発動条件",
          text: "同じ敵へ通常Pulse弾を連続で当て、集束をMAXにする。MAXになった一撃から発動する。",
        },
        {
          label: "効果",
          text: `その命中を${formatPercent(redlineCore.signature.redlineDamageMultiplier)}へ増幅し、同じ弾の貫通回数を一度だけ${redlineCore.signature.capacityRestore}回復する。`,
        },
        {
          label: "制約",
          text: `選んだ時点から最大HPが${formatPercent(redlineCore.signature.effectiveMaxHpMultiplier)}になる。反射後の命中では発動しない。`,
        },
      ],
    };
  }
  if (protocolId === fullSpanTidalSweep.id) {
    return {
      role: "手動 / 多数命中斉射",
      summary: "1回のSpread射撃で3体に当てると、広角9発の斉射を使える。",
      facts: [
        {
          label: "発動条件",
          text: `1回の通常Spread射撃を別々の敵${fullSpanTidalSweep.signature.chargeDistinctTargets}体へ当てるとCHARGE。RMB / Eで発動する。`,
        },
        {
          label: "効果",
          text: `前方約${formatDegrees(fullSpanTidalSweep.signature.arcRadians)}°へ${fullSpanTidalSweep.signature.projectileCount}発。各弾は通常弾の${formatPercent(fullSpanTidalSweep.signature.damageMultiplier)}ダメージで、敵${fullSpanTidalSweep.signature.hitCapacity}体まで貫通する。`,
        },
        {
          label: "制約",
          text: `開始時はCHARGE 0、最大${fullSpanTidalSweep.signature.maxCharges}。発動後は通常Spread射撃でもう一度ためる必要がある。`,
        },
      ],
    };
  }
  if (protocolId === breakwaterFan.id) {
    return {
      role: "手動 / 緊急離脱",
      summary: "近くの2体へ当てて準備し、HPを使って前方の敵を押し返す。",
      facts: [
        {
          label: "発動条件",
          text: `プレイヤーから${breakwaterFan.signature.chargeRangePx}px以内で、1回の通常Spread射撃を別々の敵${breakwaterFan.signature.chargeDistinctTargets}体へ当てるとCHARGE。RMB / Eで発動する。`,
        },
        {
          label: "効果",
          text: `前方${breakwaterFan.signature.coneAngleDegrees}°・${breakwaterFan.signature.rangePx}px内の最大${breakwaterFan.signature.maxTargets}体を攻撃し、通常敵をpush。`,
        },
        {
          label: "制約",
          text: `発動ごとに、選択時の最大HPの${formatPercent(breakwaterFan.signature.costGrossHpSnapshotRatio)}を現在HPから消費する。HPは1未満にならず、対象0でも消費する。再使用まで${breakwaterFan.signature.cooldownSeconds}秒。`,
        },
      ],
    };
  }
  if (protocolId !== aegisFan.id) {
    throw new Error(`Unsupported EX Protocol "${protocolId}".`);
  }
  return {
    role: "自動 / 敵弾迎撃",
    summary: "Spreadの左右端2発が、前方で交差した通常敵弾を自動で消す。",
    facts: [
      {
        label: "発動条件",
        text: "操作不要。通常Spread射撃の左右端2発が自動で迎撃弾になる。",
      },
      {
        label: "効果",
        text: `左右端の弾は、それぞれ通常敵弾を${aegisFan.signature.interceptsPerEdgeProjectile}発まで消す。`,
      },
      {
        label: "制約",
        text: `左右端の弾が敵へ与えるダメージは${formatPercent(aegisFan.signature.edgeEnemyDamageMultiplier)}。迎撃すると弾は消え、ボス弾・反射後・背後の敵弾は防げない。`,
      },
    ],
  };
}

function formatEvolutionEffect(
  protocolId: ExProtocolId,
  tier: 1 | 2,
  evolutionId: ExProtocolEvolutionId,
): string {
  if (protocolId === resonanceRelay.id) {
    if (tier === 1 && evolutionId === resonanceRelay.evolutionOne[0].id) {
      return `地点を記録する時間: ${resonanceRelay.signature.anchorLifetimeSeconds}秒 → ${resonanceRelay.evolutionOne[0].anchorLifetimeSeconds}秒`;
    }
    if (tier === 1 && evolutionId === resonanceRelay.evolutionOne[1].id) {
      return `導線の最大中間対象: ${resonanceRelay.signature.maxIntermediateTargets}体 → ${resonanceRelay.evolutionOne[1].maxIntermediateTargets}体`;
    }
    if (tier === 2 && evolutionId === resonanceRelay.evolutionTwo[0].id) {
      return `連鎖成立後、元の敵に集束${resonanceRelay.evolutionTwo[0].remainingAnchorFocusStacks}を残す`;
    }
    if (tier === 2 && evolutionId === resonanceRelay.evolutionTwo[1].id) {
      return `連鎖が成立した次の敵に集束+${resonanceRelay.evolutionTwo[1].endpointBonusFocusStacks}`;
    }
  }
  if (protocolId === reboundOverdrive.id) {
    if (tier === 1 && evolutionId === reboundOverdrive.evolutionOne[0].id) {
      return `再使用まで: ${reboundOverdrive.signature.cooldownSeconds}秒 → ${reboundOverdrive.evolutionOne[0].cooldownSeconds}秒`;
    }
    if (tier === 1 && evolutionId === reboundOverdrive.evolutionOne[1].id) {
      return `最初の反射時、発射時の貫通数に加えて+${reboundOverdrive.evolutionOne[1].capacityBonus}まで回復`;
    }
    if (tier === 2 && evolutionId === reboundOverdrive.evolutionTwo[0].id) {
      return `武装弾の反射可能回数+${reboundOverdrive.evolutionTwo[0].armedVolleyRicochetCapacityBonus}`;
    }
    if (tier === 2 && evolutionId === reboundOverdrive.evolutionTwo[1].id) {
      return `最初の反射後、その弾のダメージを${formatPercent(reboundOverdrive.evolutionTwo[1].postRicochetDamageMultiplier)}へ増幅`;
    }
  }
  if (protocolId === redlineCore.id) {
    if (tier === 1 && evolutionId === redlineCore.evolutionOne[0].id) {
      return `実効最大HP: ${formatPercent(redlineCore.signature.effectiveMaxHpMultiplier)} → ${formatPercent(redlineCore.evolutionOne[0].effectiveMaxHpMultiplier)}。増加分は即時回復しない`;
    }
    if (tier === 1 && evolutionId === redlineCore.evolutionOne[1].id) {
      return `最大集束命中: ${formatPercent(redlineCore.signature.redlineDamageMultiplier)} → ${formatPercent(redlineCore.evolutionOne[1].redlineDamageMultiplier)}`;
    }
    if (tier === 2 && evolutionId === redlineCore.evolutionTwo[0].id) {
      return `集束維持時間+${redlineCore.evolutionTwo[0].focusDurationBonusSeconds}秒`;
    }
    if (tier === 2 && evolutionId === redlineCore.evolutionTwo[1].id) {
      return `最大集束直撃時の貫通回復: ${redlineCore.signature.capacityRestore} → ${redlineCore.evolutionTwo[1].capacityRestore}`;
    }
  }
  if (protocolId === fullSpanTidalSweep.id) {
    if (
      tier === 1 &&
      evolutionId === fullSpanTidalSweep.evolutionOne[0].id
    ) {
      return `潮汐射撃の扇角: 約${formatDegrees(fullSpanTidalSweep.signature.arcRadians)}° → 約${formatDegrees(fullSpanTidalSweep.evolutionOne[0].arcRadians)}°`;
    }
    if (
      tier === 1 &&
      evolutionId === fullSpanTidalSweep.evolutionOne[1].id
    ) {
      return `潮汐弾の最大命中数: ${fullSpanTidalSweep.signature.hitCapacity}体 → ${fullSpanTidalSweep.evolutionOne[1].hitCapacity}体`;
    }
    if (
      tier === 2 &&
      evolutionId === fullSpanTidalSweep.evolutionTwo[0].id
    ) {
      return `最大charge: ${fullSpanTidalSweep.signature.maxCharges} → ${fullSpanTidalSweep.evolutionTwo[0].maxCharges}。選択時chargeは増えない`;
    }
    if (
      tier === 2 &&
      evolutionId === fullSpanTidalSweep.evolutionTwo[1].id
    ) {
      return `${fullSpanTidalSweep.evolutionTwo[1].minimumDistinctActivationHits}体以上へ命中すると現在の通常射撃timerを${formatPercent(fullSpanTidalSweep.evolutionTwo[1].currentNormalShotTimerMultiplier)}へ短縮`;
    }
  }
  if (protocolId === breakwaterFan.id) {
    if (tier === 1 && evolutionId === breakwaterFan.evolutionOne[0].id) {
      return `HP支出: ${formatPercent(breakwaterFan.signature.costGrossHpSnapshotRatio)} → ${formatPercent(breakwaterFan.evolutionOne[0].costGrossHpSnapshotRatio)}`;
    }
    if (tier === 1 && evolutionId === breakwaterFan.evolutionOne[1].id) {
      return `防波扇の全ダメージを${formatPercent(breakwaterFan.evolutionOne[1].activationDamageMultiplier)}へ増幅`;
    }
    if (tier === 2 && evolutionId === breakwaterFan.evolutionTwo[0].id) {
      return `範囲: ${breakwaterFan.signature.rangePx}px → ${breakwaterFan.evolutionTwo[0].rangePx}px。扇角は${breakwaterFan.evolutionTwo[0].coneAngleDegrees}°`;
    }
    if (tier === 2 && evolutionId === breakwaterFan.evolutionTwo[1].id) {
      return `扇角: ${breakwaterFan.signature.coneAngleDegrees}° → ${breakwaterFan.evolutionTwo[1].coneAngleDegrees}°。範囲は${breakwaterFan.evolutionTwo[1].rangePx}px`;
    }
  }
  if (protocolId === aegisFan.id) {
    if (tier === 1 && evolutionId === aegisFan.evolutionOne[0].id) {
      return `外縁弾の対敵ダメージ: ${formatPercent(aegisFan.signature.edgeEnemyDamageMultiplier)} → ${formatPercent(aegisFan.evolutionOne[0].edgeEnemyDamageMultiplier)}`;
    }
    if (tier === 1 && evolutionId === aegisFan.evolutionOne[1].id) {
      return `外縁弾の迎撃半径+${aegisFan.evolutionOne[1].interceptionRadiusBonusPx}px`;
    }
    if (tier === 2 && evolutionId === aegisFan.evolutionTwo[0].id) {
      return "迎撃しても外縁弾を消費せず、残り対敵命中数を維持。追加迎撃はしない";
    }
    if (tier === 2 && evolutionId === aegisFan.evolutionTwo[1].id) {
      return `迎撃時、移動速度${formatPercent(aegisFan.evolutionTwo[1].moveSpeedMultiplier)}を${aegisFan.evolutionTwo[1].durationSeconds}秒`;
    }
  }
  throw new Error(
    `Unsupported Evolution ${tier} "${evolutionId}" for "${protocolId}".`,
  );
}

function formatMasteryEffect(protocolId: ExProtocolId): string {
  if (protocolId === resonanceRelay.id) {
    return `中間${resonanceRelay.mastery.minimumEligibleIntermediateTargets}体以上で各対象${formatPercent(resonanceRelay.mastery.damageMultiplier)}`;
  }
  if (protocolId === reboundOverdrive.id) {
    return `反射後${reboundOverdrive.mastery.uniquePostRicochetHits}体命中で残りcooldownを${formatPercent(reboundOverdrive.mastery.remainingCooldownMultiplier)}へ短縮`;
  }
  if (protocolId === redlineCore.id) {
    return `回復貫通枠の初回命中を赤熱命中の${formatPercent(redlineCore.mastery.extraCapacityHitDamageMultiplier)}へ増幅`;
  }
  if (protocolId === fullSpanTidalSweep.id) {
    return `${fullSpanTidalSweep.mastery.minimumDistinctActivationHits}体以上で通常Sweep charge +${fullSpanTidalSweep.mastery.grantCoreSpreadSweepCharge}`;
  }
  if (protocolId === breakwaterFan.id) {
    return `${breakwaterFan.mastery.minimumAffectedNonBossTargets}体以上で移動速度${formatPercent(breakwaterFan.mastery.moveSpeedMultiplier)}を${breakwaterFan.mastery.durationSeconds}秒`;
  }
  if (protocolId === aegisFan.id) {
    return `左右両迎撃で次の外縁弾対敵ダメージ${formatPercent(aegisFan.mastery.nextVolleyEdgeEnemyDamageMultiplier)}`;
  }
  throw new Error(`Unsupported EX Protocol "${protocolId}".`);
}

function formatCurrentSignature(
  world: WorldState,
  protocolId: ExProtocolId,
): string {
  const progression = world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.route.protocolId !== protocolId
  ) {
    throw new Error(`EX Protocol "${protocolId}" is not selected.`);
  }
  const route = progression.route;
  if (route.evolutionOneId === null) return "SIGNATURE 稼働中";
  const definition = requireProtocol(protocolId);
  const evolutionOne = definition.evolutionOne.find(
    (option) => option.id === route.evolutionOneId,
  );
  if (!evolutionOne) throw new Error("Selected Evolution I is missing.");
  return `E1 ${evolutionOne.displayNameJa} / SIGNATURE 稼働中`;
}

function formatRouteLabel(world: WorldState): string {
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return "";
  const definition = requireProtocol(progression.route.protocolId);
  const e1 = definition.evolutionOne.find(
    (option) => option.id === progression.route.evolutionOneId,
  );
  const e2 = definition.evolutionTwo.find(
    (option) => option.id === progression.route.evolutionTwoId,
  );
  return [
    e1 ? `E1 ${e1.displayNameJa}` : "E1 -",
    e2 ? `E2 ${e2.displayNameJa}` : "E2 -",
    progression.route.masteryUnlocked ? "MASTERY" : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function getLatestVolley(world: WorldState): ActiveVolleyAnalytics | null {
  let latestId = -1;
  let latest: ActiveVolleyAnalytics | null = null;
  for (const [volleyId, volley] of Object.entries(
    world.analytics.activeVolleys,
  )) {
    const numericId = Number(volleyId);
    if (
      Number.isFinite(numericId) &&
      numericId > latestId &&
      volley.weaponType === world.state.weaponType
    ) {
      latestId = numericId;
      latest = volley;
    }
  }
  return latest;
}

function requireProtocol(protocolId: ExProtocolId) {
  const definition = getExProtocolDefinition(protocolId);
  if (!definition) throw new Error(`Unknown EX Protocol "${protocolId}".`);
  return definition;
}

function formatProtocolName(
  definition: ReturnType<typeof requireProtocol>,
): string {
  return `${definition.displayNameJa} / ${definition.displayNameEn}`;
}

function formatPercent(multiplier: number): string {
  return `${Math.round(multiplier * 100)}%`;
}

function formatDegrees(radians: number): string {
  return `${Math.round((radians * 180) / Math.PI)}`;
}

function formatTenths(seconds: number): string {
  return `${(Math.ceil(Math.max(0, seconds) * 10) / 10).toFixed(1)}s`;
}
