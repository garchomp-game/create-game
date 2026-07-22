import type * as Phaser from "phaser";
import type { ProfileSettings } from "../../domain/profile";
import type { GameEvent } from "../../domain/types";

export type AudioCueId =
  | "shot"
  | "hit"
  | "kill"
  | "pickup"
  | "levelUp"
  | "upgrade"
  | "sweep"
  | "damage"
  | "gameOver";

export type AudioCueSuppressionReason =
  | "victory-terminal-dedup"
  | "muted"
  | "zero-volume"
  | "cooldown"
  | "asset-unavailable";

export type AudioCueRequest = {
  sequence: number;
  eventType: GameEvent["type"];
  cue: AudioCueId;
  requestedAtMs: number;
};

export type AudioCuePlayed = AudioCueRequest & {
  asset: string;
  volume: number;
  detune: number;
};

export type AudioCueSuppressed = AudioCueRequest & {
  reason: AudioCueSuppressionReason;
};

export type AudioRoutingSnapshot = {
  requested: AudioCueRequest[];
  played: AudioCuePlayed[];
  suppressed: AudioCueSuppressed[];
};

type AudioCueRoutingDecision =
  | ({ status: "played" } & AudioCuePlayed)
  | ({ status: "suppressed" } & AudioCueSuppressed);

const EVENT_CUES: Partial<Record<GameEvent["type"], AudioCueId>> = {
  "shot.fired": "shot",
  "enemy.hit": "hit",
  "enemy.killed": "kill",
  "pickup.collected": "pickup",
  "player.level_up": "levelUp",
  "extra.level_up": "levelUp",
  "encounter.warning.started": "levelUp",
  "encounter.started": "damage",
  "expedition.act.changed": "upgrade",
  "expedition.encounter.selected": "levelUp",
  "expedition.encounter.active.started": "damage",
  "expedition.completed": "sweep",
  "boss.spawned": "upgrade",
  "boss.attack.telegraphed": "levelUp",
  "boss.attack.executed": "damage",
  "boss.phase.changed": "damage",
  "boss.defeated": "sweep",
  "elite.commander.spawned": "upgrade",
  "elite.commander.reinforcement.telegraphed": "levelUp",
  "elite.commander.reinforcement.deployed": "damage",
  "elite.commander.pressure.lowered": "sweep",
  "enemy.charger.telegraph.started": "levelUp",
  "enemy.charger.prepare.started": "upgrade",
  "enemy.charger.charge.started": "damage",
  "enemy.charger.charge.ended": "sweep",
  "contract.offered": "upgrade",
  "upgrade.selected": "upgrade",
  "extra.upgrade.selected": "upgrade",
  "spread.sweep.triggered": "sweep",
  "player.damaged": "damage",
  "game.over": "gameOver",
};

const CUE_VOLUMES: Record<AudioCueId, number> = {
  shot: 0.2,
  hit: 0.16,
  kill: 0.3,
  pickup: 0.18,
  levelUp: 0.38,
  upgrade: 0.34,
  sweep: 0.26,
  damage: 0.38,
  gameOver: 0.44,
};

const CUE_ASSETS: Record<AudioCueId, readonly string[]> = {
  shot: ["shot", "shotAlt1", "shotAlt2"],
  hit: ["hit", "hitAlt1", "hitAlt2"],
  kill: ["kill", "killAlt1"],
  pickup: ["pickup", "pickupAlt1"],
  levelUp: ["levelUp"],
  upgrade: ["upgrade"],
  sweep: ["upgrade"],
  damage: ["damage", "damageAlt1"],
  gameOver: ["gameOver"],
};

const CUE_DETUNE: Record<AudioCueId, readonly number[]> = {
  shot: [0, 22, -18],
  hit: [0, -16, 18],
  kill: [0, 14],
  pickup: [0, 18],
  levelUp: [0],
  upgrade: [0],
  sweep: [120],
  damage: [0, -14],
  gameOver: [0],
};

const CUE_COOLDOWNS: Record<AudioCueId, number> = {
  shot: 35,
  hit: 30,
  kill: 45,
  pickup: 50,
  levelUp: 150,
  upgrade: 150,
  sweep: 120,
  damage: 100,
  gameOver: 300,
};

export class PhaserAudioEventRouter {
  private readonly lastCues: AudioCueId[] = [];
  private readonly routingDecisions: AudioCueRoutingDecision[] = [];
  private readonly lastPlayedAt = new Map<AudioCueId, number>();
  private readonly nextVariant = new Map<AudioCueId, number>();
  private nextRequestSequence = 0;
  private volume = 1;
  private muted = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly observeRouting = false,
  ) {}

  configure(settings: Pick<ProfileSettings, "sfxVolume" | "sfxMuted">): void {
    this.volume = settings.sfxVolume;
    this.muted = settings.sfxMuted;
  }

  handleEvents(events: GameEvent[]): void {
    const expeditionVictory = events.some(
      (event) => event.type === "expedition.completed",
    );
    for (const event of events) {
      const cue = EVENT_CUES[event.type];
      if (!cue) continue;

      const requestedAtMs = this.scene.time.now;
      const request: AudioCueRequest | null = this.observeRouting
        ? {
            sequence: this.nextRequestSequence++,
            eventType: event.type,
            cue,
            requestedAtMs,
          }
        : null;
      if (expeditionVictory && event.type === "game.over") {
        this.suppress(request, "victory-terminal-dedup");
        continue;
      }

      this.lastCues.push(cue);
      this.tryPlay(cue, requestedAtMs, request);
    }
    this.lastCues.splice(0, Math.max(0, this.lastCues.length - 20));
  }

  reset(): void {
    this.lastCues.length = 0;
    this.routingDecisions.length = 0;
    this.lastPlayedAt.clear();
    this.nextVariant.clear();
    this.nextRequestSequence = 0;
  }

  getLastCues(): AudioCueId[] {
    return [...this.lastCues];
  }

  getRoutingSnapshot(): AudioRoutingSnapshot {
    const requested: AudioCueRequest[] = [];
    const played: AudioCuePlayed[] = [];
    const suppressed: AudioCueSuppressed[] = [];
    for (const decision of this.routingDecisions) {
      const request = copyRequest(decision);
      requested.push(request);
      if (decision.status === "played") {
        played.push({
          ...request,
          asset: decision.asset,
          volume: decision.volume,
          detune: decision.detune,
        });
      } else {
        suppressed.push({ ...request, reason: decision.reason });
      }
    }
    return { requested, played, suppressed };
  }

  private tryPlay(
    cue: AudioCueId,
    requestedAtMs: number,
    request: AudioCueRequest | null,
  ): void {
    if (this.muted) {
      this.suppress(request, "muted");
      return;
    }
    if (this.volume === 0) {
      this.suppress(request, "zero-volume");
      return;
    }
    const lastPlayed =
      this.lastPlayedAt.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (requestedAtMs - lastPlayed < CUE_COOLDOWNS[cue]) {
      this.suppress(request, "cooldown");
      return;
    }
    const variants = CUE_ASSETS[cue];
    const variantIndex = this.nextVariant.get(cue) ?? 0;
    const asset = variants[variantIndex % variants.length];
    if (!this.scene.cache.audio.exists(asset)) {
      this.suppress(request, "asset-unavailable");
      return;
    }
    const volume = CUE_VOLUMES[cue] * this.volume;
    const detune =
      CUE_DETUNE[cue][variantIndex % CUE_DETUNE[cue].length];
    this.lastPlayedAt.set(cue, requestedAtMs);
    this.nextVariant.set(
      cue,
      (variantIndex + 1) % variants.length,
    );

    this.scene.sound.play(asset, {
      volume,
      detune,
    });
    if (request) {
      this.recordDecision({
        ...request,
        status: "played",
        asset,
        volume,
        detune,
      });
    }
  }

  private suppress(
    request: AudioCueRequest | null,
    reason: AudioCueSuppressionReason,
  ): void {
    if (!request) return;
    this.recordDecision({ ...request, status: "suppressed", reason });
  }

  private recordDecision(decision: AudioCueRoutingDecision): void {
    this.routingDecisions.push(decision);
    this.routingDecisions.splice(
      0,
      Math.max(0, this.routingDecisions.length - 40),
    );
  }
}

function copyRequest(decision: AudioCueRoutingDecision): AudioCueRequest {
  return {
    sequence: decision.sequence,
    eventType: decision.eventType,
    cue: decision.cue,
    requestedAtMs: decision.requestedAtMs,
  };
}
