import type {
  ArenaBoundarySide,
  Enemy,
  ExProtocolEnemyDamageSource,
  GameEvent,
  RicochetSurfaceKind,
  WeaponTypeId,
  WorldState,
} from "../../domain/types";
import type { ExProtocolId } from "../../domain/exProtocols";
import { releaseCommanderPressure } from "./commanderEliteSystem";
import { recordChargerKilled } from "./chargerEnemySystem";

export type PlayerProjectileDamageSource = {
  kind: "player-projectile";
  bulletId: string;
  volleyId: number;
  weaponType: WeaponTypeId;
  ricochetsUsed: number;
  ricochetSurfaceKind: RicochetSurfaceKind | null;
  ricochetBoundarySide: ArenaBoundarySide | null;
  protocolId?: ExProtocolId;
  activationId?: number;
  attribution:
    | "normal"
    | "protocol-modified-normal"
    | "protocol-restored-capacity"
    | "protocol-volley"
    | "uncredited-penalty";
};

export type EnemyDamageSource =
  | PlayerProjectileDamageSource
  | (ExProtocolEnemyDamageSource & { weaponType: WeaponTypeId });

export type EnemyDamageRequest = {
  amount: number;
  baselineWithoutAnyProtocol: number;
  baselineForEffectAttribution: number;
  source: EnemyDamageSource;
};

export type EnemyDamageOutcome = {
  applied: boolean;
  enemyId: string;
  hpBefore: number;
  hpAfter: number;
  damage: number;
  killed: boolean;
  scoreAwarded: number;
  baselineWithoutAnyProtocol: number;
  baselineForEffectAttribution: number;
  source: EnemyDamageSource;
};

export type EnemyDamageHooks = {
  afterHit?: (outcome: EnemyDamageOutcome) => void;
};

export function resolveEnemyDamage(
  world: WorldState,
  enemy: Enemy,
  request: EnemyDamageRequest,
  deadEnemies: Set<Enemy>,
  events: GameEvent[],
  hooks: EnemyDamageHooks = {},
): EnemyDamageOutcome {
  const hpBefore = enemy.hp;
  if (deadEnemies.has(enemy) || hpBefore <= 0 || request.amount <= 0) {
    return createNoopOutcome(enemy, hpBefore, request);
  }

  const damage = Math.max(0, request.amount);
  enemy.hp -= damage;
  const outcome: EnemyDamageOutcome = {
    applied: true,
    enemyId: enemy.id,
    hpBefore,
    hpAfter: Math.max(0, enemy.hp),
    damage,
    killed: enemy.hp <= 0,
    scoreAwarded: 0,
    baselineWithoutAnyProtocol: request.baselineWithoutAnyProtocol,
    baselineForEffectAttribution: request.baselineForEffectAttribution,
    source: request.source,
  };

  events.push(createHitEvent(enemy, outcome));
  hooks.afterHit?.(outcome);
  if (!outcome.killed) return outcome;

  deadEnemies.add(enemy);
  const weaponType = request.source.weaponType;
  releaseCommanderPressure(world, enemy, weaponType, events);
  recordChargerKilled(world, enemy, weaponType, events);
  const scoreAwarded = Math.round(
    enemy.score * world.encounter.contract.scoreMultiplier,
  );
  world.state.score += scoreAwarded;
  outcome.scoreAwarded = scoreAwarded;
  events.push(createKillEvent(enemy, outcome, scoreAwarded));
  return outcome;
}

function createNoopOutcome(
  enemy: Enemy,
  hpBefore: number,
  request: EnemyDamageRequest,
): EnemyDamageOutcome {
  return {
    applied: false,
    enemyId: enemy.id,
    hpBefore,
    hpAfter: Math.max(0, hpBefore),
    damage: 0,
    killed: hpBefore <= 0,
    scoreAwarded: 0,
    baselineWithoutAnyProtocol: request.baselineWithoutAnyProtocol,
    baselineForEffectAttribution: request.baselineForEffectAttribution,
    source: request.source,
  };
}

function createHitEvent(
  enemy: Enemy,
  outcome: EnemyDamageOutcome,
): GameEvent {
  const source = outcome.source;
  if (source.kind === "player-projectile") {
    const protocolSource = toProtocolVolleySource(source);
    if (protocolSource) {
      return {
        type: "enemy.protocol.hit",
        source: protocolSource,
        enemyId: enemy.id,
        enemyType: enemy.typeId,
        weaponType: source.weaponType,
        damage: outcome.damage,
        hpAfter: outcome.hpAfter,
      };
    }
    return {
      type: "enemy.hit",
      bulletId: source.bulletId,
      volleyId: source.volleyId,
      enemyId: enemy.id,
      enemyType: enemy.typeId,
      weaponType: source.weaponType,
      ricochetsUsed: source.ricochetsUsed,
      ricochetSurfaceKind: source.ricochetSurfaceKind,
      ricochetBoundarySide: source.ricochetBoundarySide,
      damage: outcome.damage,
      hpAfter: outcome.hpAfter,
    };
  }
  return {
    type: "enemy.protocol.hit",
    source: toPublicProtocolSource(source),
    enemyId: enemy.id,
    enemyType: enemy.typeId,
    weaponType: source.weaponType,
    damage: outcome.damage,
    hpAfter: outcome.hpAfter,
  };
}

function createKillEvent(
  enemy: Enemy,
  outcome: EnemyDamageOutcome,
  scoreAwarded: number,
): GameEvent {
  const source = outcome.source;
  if (source.kind === "player-projectile") {
    const protocolSource = toProtocolVolleySource(source);
    if (protocolSource) {
      return {
        type: "enemy.protocol.killed",
        source: protocolSource,
        enemyId: enemy.id,
        enemyType: enemy.typeId,
        weaponType: source.weaponType,
        scoreAwarded,
        xpAwarded: enemy.xpValue,
        position: { ...enemy.position },
      };
    }
    return {
      type: "enemy.killed",
      bulletId: source.bulletId,
      volleyId: source.volleyId,
      enemyId: enemy.id,
      enemyType: enemy.typeId,
      weaponType: source.weaponType,
      scoreAwarded,
      xpAwarded: enemy.xpValue,
      position: { ...enemy.position },
    };
  }
  return {
    type: "enemy.protocol.killed",
    source: toPublicProtocolSource(source),
    enemyId: enemy.id,
    enemyType: enemy.typeId,
    weaponType: source.weaponType,
    scoreAwarded,
    xpAwarded: enemy.xpValue,
    position: { ...enemy.position },
  };
}

function toProtocolVolleySource(
  source: PlayerProjectileDamageSource,
): ExProtocolEnemyDamageSource | null {
  if (
    source.attribution !== "protocol-volley" ||
    !source.protocolId ||
    source.activationId === undefined
  ) {
    return null;
  }
  return {
    kind: "ex-protocol",
    protocolId: source.protocolId,
    activationId: source.activationId,
    effect: "tidal",
  };
}

function toPublicProtocolSource(
  source: Extract<EnemyDamageSource, { kind: "ex-protocol" }>,
): ExProtocolEnemyDamageSource {
  return {
    kind: source.kind,
    protocolId: source.protocolId,
    activationId: source.activationId,
    effect: source.effect,
  };
}
