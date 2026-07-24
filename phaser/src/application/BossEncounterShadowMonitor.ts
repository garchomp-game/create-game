import {
  BOSS_ATTACK_IDS,
  type BossAttackId,
  type GameEvent,
  type PlayerDamageSource,
  type WorldState,
} from "../domain/types";
import {
  BOSS_CENTRAL_ORBIT_RADIUS,
  BOSS_SHADOW_BIN_SECONDS,
  type BossShadowReport,
} from "../domain/bossShadow";
import {
  createBossShadowReport,
  type BossShadowEpisodeInput,
  type BossShadowTimeBinInput,
} from "./bossShadowReport";
export { createEmptyBossShadowReport } from "./bossShadowReport";

type MutableEpisode = BossShadowEpisodeInput;
type MutableTimeBin = BossShadowTimeBinInput;

type ActiveBoss = {
  bossId: string;
  enemyId: string;
  spawnedAt: number;
  defeatedAt: number | null;
};

export class BossEncounterShadowMonitor {
  private activeBoss: ActiveBoss | null = null;
  private episodes: MutableEpisode[] = [];
  private bins = new Map<number, MutableTimeBin>();
  private projectileEpisodes = new Map<string, number>();
  private escortEpisodes = new Map<string, number>();
  private exposureCounts = emptyAttackCounts();
  private lastObservedElapsed = 0;
  private sampledSeconds = 0;
  private centralOrbitSeconds = 0;
  private playerDamage = 0;
  private hpRecovered = 0;
  private healPickupsCollected = 0;
  private healPickupsCollectedAtFullHp = 0;
  private regularEnemiesKilled = 0;

  reset(world: WorldState): void {
    this.activeBoss = null;
    this.episodes = [];
    this.bins.clear();
    this.projectileEpisodes.clear();
    this.escortEpisodes.clear();
    this.exposureCounts = emptyAttackCounts();
    this.lastObservedElapsed = finiteNonNegative(world.state.elapsed);
    this.sampledSeconds = 0;
    this.centralOrbitSeconds = 0;
    this.playerDamage = 0;
    this.hpRecovered = 0;
    this.healPickupsCollected = 0;
    this.healPickupsCollectedAtFullHp = 0;
    this.regularEnemiesKilled = 0;
  }

  observe(world: WorldState, sourceEvents: readonly GameEvent[]): void {
    const observedAt = finiteNonNegative(world.state.elapsed);
    const events = sourceEvents
      .map((event, sequence) => ({
        event,
        sequence,
        elapsed: eventElapsed(event, observedAt),
      }))
      .sort((left, right) => left.elapsed - right.elapsed || left.sequence - right.sequence);

    for (const observed of events) this.observeEvent(observed.event, observed.elapsed);
    this.observePosition(world, observedAt);
    this.lastObservedElapsed = observedAt;
  }

  getReport(observedUntil: number): BossShadowReport {
    return createBossShadowReport({
      boss: this.activeBoss ? { ...this.activeBoss } : null,
      observedUntil,
      playerDamage: this.playerDamage,
      hpRecovered: this.hpRecovered,
      healPickupsCollected: this.healPickupsCollected,
      healPickupsCollectedAtFullHp: this.healPickupsCollectedAtFullHp,
      regularEnemiesKilled: this.regularEnemiesKilled,
      sampledSeconds: this.sampledSeconds,
      centralOrbitSeconds: this.centralOrbitSeconds,
      episodes: this.episodes,
      bins: [...this.bins.values()],
    });
  }

  private observeEvent(event: GameEvent, elapsed: number): void {
    if (event.type === "boss.spawned") {
      this.activeBoss = {
        bossId: event.bossId,
        enemyId: event.enemyId,
        spawnedAt: event.elapsed,
        defeatedAt: null,
      };
      return;
    }
    const boss = this.activeBoss;
    if (!boss || boss.defeatedAt !== null || elapsed < boss.spawnedAt) return;

    if (event.type === "boss.attack.telegraphed") {
      this.closeOpenResponses(event.elapsed);
      const exposureIndex = ++this.exposureCounts[event.attackId];
      this.episodes.push({
        episodeId: `${event.bossId}:${event.attackId}:${exposureIndex}`,
        bossId: event.bossId,
        enemyId: event.enemyId,
        attackId: event.attackId,
        phase: event.phase,
        exposureIndex,
        telegraphedAt: event.elapsed,
        executedAt: null,
        recoveryStartedAt: null,
        recoveryEndsAt: null,
        responseEndsAt: null,
        commandPulseResult: null,
        playerHits: 0,
        playerDamage: 0,
        bossDamageDuringRecovery: 0,
        playerBossDistanceAtRecoveryStart: null,
        playerBossDistanceAtRecoveryEnd: null,
      });
      return;
    }
    if (event.type === "boss.attack.executed") {
      const index = this.findLatestEpisodeIndex(event.attackId);
      const episode = this.episodes[index];
      if (!episode) return;
      episode.executedAt = event.elapsed;
      event.projectileIds.forEach((id) => this.projectileEpisodes.set(id, index));
      return;
    }
    if (event.type === "boss.attack.recovery.started") {
      const episode = this.episodes[this.findLatestEpisodeIndex(event.attackId)];
      if (!episode) return;
      episode.recoveryStartedAt = event.elapsed;
      episode.recoveryEndsAt = event.recoveryEndsAt;
      return;
    }
    if (event.type === "boss.escort.deployed") {
      const index = this.findLatestEpisodeIndex(event.attackId);
      event.enemyIds.forEach((id) => this.escortEpisodes.set(id, index));
      return;
    }
    if (event.type === "boss.command-pulse.resolved") {
      const episode = this.episodes[this.findLatestEpisodeIndex("command-pulse")];
      if (episode) episode.commandPulseResult = event.result;
      return;
    }
    if (event.type === "player.damaged") {
      this.playerDamage += event.damage;
      this.getBin(elapsed).playerDamage += event.damage;
      const episode = this.findDamageEpisode(event.source ?? null, elapsed);
      if (episode) {
        episode.playerHits += 1;
        episode.playerDamage += event.damage;
      }
      return;
    }
    if (event.type === "pickup.collected" && event.pickupKind === "heal") {
      this.hpRecovered += event.hpRecovered;
      this.healPickupsCollected += 1;
      if (event.hpRecovered === 0) this.healPickupsCollectedAtFullHp += 1;
      const bin = this.getBin(elapsed);
      bin.hpRecovered += event.hpRecovered;
      bin.healPickupsCollected += 1;
      if (event.hpRecovered === 0) bin.healPickupsCollectedAtFullHp += 1;
      return;
    }
    if (event.type === "enemy.killed") {
      if (event.enemyId !== boss.enemyId) {
        this.regularEnemiesKilled += 1;
        this.getBin(elapsed).regularEnemiesKilled += 1;
      }
      return;
    }
    if (event.type === "enemy.hit" && event.enemyId === boss.enemyId) {
      const episode = this.findRecoveryEpisode(elapsed);
      if (episode) episode.bossDamageDuringRecovery += event.damage;
      return;
    }
    if (event.type === "boss.defeated") {
      boss.defeatedAt = event.elapsed;
      this.closeOpenResponses(event.elapsed);
      return;
    }
    if (event.type === "expedition.failed" || event.type === "expedition.completed") {
      this.closeOpenResponses(event.elapsed);
    }
  }

  private observePosition(world: WorldState, observedAt: number): void {
    const boss = this.activeBoss;
    if (!boss || boss.defeatedAt !== null) return;
    const elapsedDelta = Math.max(
      0,
      observedAt - Math.max(this.lastObservedElapsed, boss.spawnedAt),
    );
    const bossEnemy = world.enemies.find((enemy) => enemy.id === boss.enemyId);
    if (bossEnemy && elapsedDelta > 0) {
      const playerBossDistance = distance(world.player.position, bossEnemy.position);
      this.sampledSeconds += elapsedDelta;
      if (playerBossDistance <= BOSS_CENTRAL_ORBIT_RADIUS) {
        this.centralOrbitSeconds += elapsedDelta;
      }
      const recovery = this.findRecoveryEpisode(observedAt);
      if (recovery) {
        recovery.playerBossDistanceAtRecoveryStart ??= playerBossDistance;
        recovery.playerBossDistanceAtRecoveryEnd = playerBossDistance;
      }
    }

  }

  private findDamageEpisode(
    source: PlayerDamageSource | null,
    elapsed: number,
  ): MutableEpisode | null {
    let index: number | undefined;
    if (source?.kind === "projectile") {
      index = this.projectileEpisodes.get(source.projectileId);
    } else if (source?.kind === "contact") {
      index = this.escortEpisodes.get(source.enemyId);
    }
    if (
      index === undefined &&
      source !== null &&
      "bossAttackId" in source &&
      source.bossAttackId
    ) {
      index = this.findLatestEpisodeIndex(source.bossAttackId);
    }
    const episode = index === undefined ? null : this.episodes[index] ?? null;
    if (!episode) return null;
    if (episode.responseEndsAt !== null && elapsed > episode.responseEndsAt) return null;
    return episode;
  }

  private findLatestEpisodeIndex(attackId: BossAttackId): number {
    for (let index = this.episodes.length - 1; index >= 0; index -= 1) {
      if (this.episodes[index]?.attackId === attackId) return index;
    }
    return -1;
  }

  private findRecoveryEpisode(elapsed: number): MutableEpisode | null {
    for (let index = this.episodes.length - 1; index >= 0; index -= 1) {
      const episode = this.episodes[index]!;
      if (
        episode.recoveryStartedAt !== null &&
        episode.recoveryEndsAt !== null &&
        elapsed >= episode.recoveryStartedAt &&
        elapsed <= episode.recoveryEndsAt
      ) {
        return episode;
      }
    }
    return null;
  }

  private closeOpenResponses(elapsed: number): void {
    for (const episode of this.episodes) {
      if (episode.responseEndsAt === null) episode.responseEndsAt = elapsed;
    }
  }

  private getBin(elapsed: number): MutableTimeBin {
    const boss = this.activeBoss!;
    const relative = Math.max(0, elapsed - boss.spawnedAt);
    const index = Math.floor(relative / BOSS_SHADOW_BIN_SECONDS);
    const existing = this.bins.get(index);
    if (existing) return existing;
    const created: MutableTimeBin = {
      index,
      startsAtBossSeconds: index * BOSS_SHADOW_BIN_SECONDS,
      endsAtBossSeconds: (index + 1) * BOSS_SHADOW_BIN_SECONDS,
      playerDamage: 0,
      hpRecovered: 0,
      healPickupsCollected: 0,
      healPickupsCollectedAtFullHp: 0,
      regularEnemiesKilled: 0,
    };
    this.bins.set(index, created);
    return created;
  }
}

function eventElapsed(event: GameEvent, fallback: number): number {
  return "elapsed" in event && typeof event.elapsed === "number"
    ? finiteNonNegative(event.elapsed)
    : fallback;
}

function emptyAttackCounts(): Record<BossAttackId, number> {
  return Object.fromEntries(BOSS_ATTACK_IDS.map((id) => [id, 0])) as Record<
    BossAttackId,
    number
  >;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function distance(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
