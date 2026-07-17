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

const EVENT_CUES: Partial<Record<GameEvent["type"], AudioCueId>> = {
  "shot.fired": "shot",
  "enemy.hit": "hit",
  "enemy.killed": "kill",
  "pickup.collected": "pickup",
  "player.level_up": "levelUp",
  "extra.level_up": "levelUp",
  "encounter.warning.started": "levelUp",
  "encounter.started": "damage",
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
  private readonly lastPlayedAt = new Map<AudioCueId, number>();
  private readonly nextVariant = new Map<AudioCueId, number>();
  private volume = 1;
  private muted = false;

  constructor(private readonly scene: Phaser.Scene) {}

  configure(settings: Pick<ProfileSettings, "sfxVolume" | "sfxMuted">): void {
    this.volume = settings.sfxVolume;
    this.muted = settings.sfxMuted;
  }

  handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      const cue = EVENT_CUES[event.type];
      if (!cue) continue;

      this.lastCues.push(cue);
      this.tryPlay(cue);
    }
    this.lastCues.splice(0, Math.max(0, this.lastCues.length - 20));
  }

  reset(): void {
    this.lastCues.length = 0;
    this.lastPlayedAt.clear();
    this.nextVariant.clear();
  }

  getLastCues(): AudioCueId[] {
    return [...this.lastCues];
  }

  private tryPlay(cue: AudioCueId): void {
    if (this.muted || this.volume === 0) return;
    const now = this.scene.time.now;
    const lastPlayed = this.lastPlayedAt.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (now - lastPlayed < CUE_COOLDOWNS[cue]) return;
    const variants = CUE_ASSETS[cue];
    const variantIndex = this.nextVariant.get(cue) ?? 0;
    const asset = variants[variantIndex % variants.length];
    if (!this.scene.cache.audio.exists(asset)) return;
    this.lastPlayedAt.set(cue, now);
    this.nextVariant.set(cue, (variantIndex + 1) % variants.length);

    this.scene.sound.play(asset, {
      volume: CUE_VOLUMES[cue] * this.volume,
      detune: CUE_DETUNE[cue][variantIndex % CUE_DETUNE[cue].length],
    });
  }
}
