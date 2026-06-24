import Phaser from "phaser";
import type { GameEvent } from "../../domain/types";

export type AudioCueId =
  | "shot"
  | "hit"
  | "kill"
  | "pickup"
  | "levelUp"
  | "upgrade"
  | "damage"
  | "gameOver";

const EVENT_CUES: Partial<Record<GameEvent["type"], AudioCueId>> = {
  "shot.fired": "shot",
  "enemy.hit": "hit",
  "enemy.killed": "kill",
  "pickup.collected": "pickup",
  "player.level_up": "levelUp",
  "upgrade.selected": "upgrade",
  "player.damaged": "damage",
  "game.over": "gameOver",
};

const CUE_VOLUMES: Record<AudioCueId, number> = {
  shot: 0.24,
  hit: 0.18,
  kill: 0.32,
  pickup: 0.18,
  levelUp: 0.42,
  upgrade: 0.36,
  damage: 0.42,
  gameOver: 0.48,
};

export class PhaserAudioEventRouter {
  private readonly lastCues: AudioCueId[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

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
  }

  getLastCues(): AudioCueId[] {
    return [...this.lastCues];
  }

  private tryPlay(cue: AudioCueId): void {
    if (!this.scene.cache.audio.exists(cue)) return;

    this.scene.sound.play(cue, {
      volume: CUE_VOLUMES[cue],
    });
  }
}
