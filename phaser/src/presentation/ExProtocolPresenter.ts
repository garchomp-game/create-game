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
  label: "TRIGGER" | "EFFECT" | "COST / LIMIT";
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
      title: "EX Lv 0 / PROTOCOL SELECT",
      subtitle: "通常ビルドに接続する戦闘教義を選択",
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
        ? `端点 ACTIVE ${formatTenths(remaining)}`
        : "稼働中",
      secondary: runtime.anchor
        ? "端点保持中 / 別の敵へ通常弾を当てる"
        : "最大集束から導線を生成",
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
      secondary: `予約HP ${capacity.reservedHp}/${capacity.grossMaxHp} (${ratio}%)`,
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
    primary: "稼働中",
    secondary: progression.route.masteryUnlocked
      ? `完全防護 ${runtime.perfectGuardCharges}/${aegisFan.mastery.maxCharges}`
      : "外縁弾で標準敵弾を迎撃",
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
      definition.interaction === "active" ? "RMB / E で能動発動" : null,
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
    facts: [{ label: "EFFECT", text: effect }],
    inputHint: null,
    ariaLabel: `${title}。EFFECT: ${effect}`,
  };
}

function getProtocolCopy(
  protocolId: ExProtocolId,
): Pick<ExProtocolChoiceCardViewModel, "role" | "summary" | "facts"> {
  if (protocolId === resonanceRelay.id) {
    return {
      role: "射線編集・集束消費",
      summary: "最大集束した2体を導線で結び、射線上の敵へ連鎖する。",
      facts: [
        {
          label: "TRIGGER",
          text: `最大集束した敵を${resonanceRelay.signature.anchorLifetimeSeconds}秒間端点にし、後続の通常Pulse射撃を別の敵へ当てる。`,
        },
        {
          label: "EFFECT",
          text: `間にいる最大${resonanceRelay.signature.maxIntermediateTargets}体へ通常弾の${formatPercent(resonanceRelay.signature.damageMultiplier)}ダメージ。`,
        },
        {
          label: "COST / LIMIT",
          text: "障害物で遮断。同じ射撃内では成立せず、成立時は端点の集束を失う。",
        },
      ],
    };
  }
  if (protocolId === reboundOverdrive.id) {
    return {
      role: "能動反射・貫通再装填",
      summary: "次の通常射撃を武装し、反射時に貫通枠を再装填する。",
      facts: [
        {
          label: "TRIGGER",
          text: `RMB / Eで次の通常Pulse射撃を${reboundOverdrive.signature.armDurationSeconds}秒間武装。Cooldown ${reboundOverdrive.signature.cooldownSeconds}秒。`,
        },
        {
          label: "EFFECT",
          text: "最初の反射時、残り貫通数を発射時の値まで回復。",
        },
        {
          label: "COST / LIMIT",
          text: "時間切れ・空振り・未反射でもcooldownを返却せず、同じ敵の再命中制限は維持。",
        },
      ],
    };
  }
  if (protocolId === redlineCore.id) {
    return {
      role: "HP上限予約・精密火力",
      summary: "生存余力を予約し、最大集束への直撃を高火力化する。",
      facts: [
        {
          label: "TRIGGER",
          text: "最大集束へ到達済みの敵へ、反射前の通常Pulse弾を直撃。",
        },
        {
          label: "EFFECT",
          text: `命中を${formatPercent(redlineCore.signature.redlineDamageMultiplier)}へ増幅し、同じ弾で一度だけ貫通数を${redlineCore.signature.capacityRestore}回復。`,
        },
        {
          label: "COST / LIMIT",
          text: `gross最大HPの${formatPercent(1 - redlineCore.signature.effectiveMaxHpMultiplier)}を予約。実効最大HPは${formatPercent(redlineCore.signature.effectiveMaxHpMultiplier)}。`,
        },
      ],
    };
  }
  if (protocolId === fullSpanTidalSweep.id) {
    return {
      role: "全幅捕捉・能動斉射",
      summary: "Spread全幅で敵群を捉え、広角の潮汐斉射へ変換する。",
      facts: [
        {
          label: "TRIGGER",
          text: `通常Spreadの両外縁弾を別々の敵へ当て、合計${fullSpanTidalSweep.signature.chargeDistinctTargets}体を捉えてcharge。RMB / Eで発動。`,
        },
        {
          label: "EFFECT",
          text: `前方${fullSpanTidalSweep.signature.arcRadians}radへ${fullSpanTidalSweep.signature.projectileCount}発。各弾${formatPercent(fullSpanTidalSweep.signature.damageMultiplier)}、最大${fullSpanTidalSweep.signature.hitCapacity}体。`,
        },
        {
          label: "COST / LIMIT",
          text: `開始0、最大${fullSpanTidalSweep.signature.maxCharges} charge。再使用には再chargeが必要。潮汐弾自身ではchargeしない。`,
        },
      ],
    };
  }
  if (protocolId === breakwaterFan.id) {
    return {
      role: "近距離破囲・HP支出",
      summary: "近距離の捕捉を、HPを支払う即時の前方制圧へ変換する。",
      facts: [
        {
          label: "TRIGGER",
          text: `${breakwaterFan.signature.chargeRangePx}px以内の別々の敵${breakwaterFan.signature.chargeDistinctTargets}体へ命中してcharge。RMB / Eで発動。`,
        },
        {
          label: "EFFECT",
          text: `前方${breakwaterFan.signature.coneAngleDegrees}°・${breakwaterFan.signature.rangePx}px内の最大${breakwaterFan.signature.maxTargets}体を攻撃し、通常敵をpush。`,
        },
        {
          label: "COST / LIMIT",
          text: `選択時gross最大HPの${formatPercent(breakwaterFan.signature.costGrossHpSnapshotRatio)}を支出。Cooldown ${breakwaterFan.signature.cooldownSeconds}秒。対象0でも消費。`,
        },
      ],
    };
  }
  if (protocolId !== aegisFan.id) {
    throw new Error(`Unsupported EX Protocol "${protocolId}".`);
  }
  return {
    role: "外縁火力・方向防御交換",
    summary: "左右外縁弾の火力を、防御方向を作る迎撃能力へ交換する。",
    facts: [
      {
        label: "TRIGGER",
        text: "通常Spread射撃の左右外縁弾が自動で迎撃弾になる。",
      },
      {
        label: "EFFECT",
        text: `各外縁弾は標準敵弾を${aegisFan.signature.interceptsPerEdgeProjectile}発迎撃。`,
      },
      {
        label: "COST / LIMIT",
        text: `外縁弾の対敵ダメージは${formatPercent(aegisFan.signature.edgeEnemyDamageMultiplier)}。迎撃時に消失し、Boss弾・反射後・背面は防げない。`,
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
      return `端点の持続時間: ${resonanceRelay.signature.anchorLifetimeSeconds}秒 → ${resonanceRelay.evolutionOne[0].anchorLifetimeSeconds}秒`;
    }
    if (tier === 1 && evolutionId === resonanceRelay.evolutionOne[1].id) {
      return `導線の最大中間対象: ${resonanceRelay.signature.maxIntermediateTargets}体 → ${resonanceRelay.evolutionOne[1].maxIntermediateTargets}体`;
    }
    if (tier === 2 && evolutionId === resonanceRelay.evolutionTwo[0].id) {
      return `導線成立後、元の端点に集束${resonanceRelay.evolutionTwo[0].remainingAnchorFocusStacks}を残す`;
    }
    if (tier === 2 && evolutionId === resonanceRelay.evolutionTwo[1].id) {
      return `遮られず成立した導線の終点に集束+${resonanceRelay.evolutionTwo[1].endpointBonusFocusStacks}`;
    }
  }
  if (protocolId === reboundOverdrive.id) {
    if (tier === 1 && evolutionId === reboundOverdrive.evolutionOne[0].id) {
      return `Cooldown: ${reboundOverdrive.signature.cooldownSeconds}秒 → ${reboundOverdrive.evolutionOne[0].cooldownSeconds}秒`;
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
      return `潮汐射撃の扇角: ${fullSpanTidalSweep.signature.arcRadians}rad → ${fullSpanTidalSweep.evolutionOne[0].arcRadians}rad`;
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

function formatTenths(seconds: number): string {
  return `${(Math.ceil(Math.max(0, seconds) * 10) / 10).toFixed(1)}s`;
}
