import type * as Phaser from "phaser";
import type { ProfileSettings } from "../../domain/profile";
import type { GameStatus } from "../../domain/types";

const MUSIC_KEY = "bgmEndless";

export type MusicSnapshot = {
  loaded: boolean;
  playing: boolean;
  volume: number;
  muted: boolean;
};

export class PhaserMusicController {
  private music: Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound | null = null;
  private volume = 1;
  private muted = false;
  private status: GameStatus = "title";

  constructor(private readonly scene: Phaser.Scene) {}

  configure(settings: Pick<ProfileSettings, "bgmVolume" | "bgmMuted">): void {
    this.volume = settings.bgmVolume;
    this.muted = settings.bgmMuted;
    this.applyVolume(this.status);
  }

  sync(status: GameStatus): void {
    this.status = status;
    if (status === "gameOver") {
      if (this.music?.isPlaying) this.music.stop();
      return;
    }
    if (this.scene.sound.locked || !this.scene.cache.audio.exists(MUSIC_KEY)) return;

    this.music ??= this.scene.sound.add(MUSIC_KEY, { loop: true }) as
      | Phaser.Sound.HTML5AudioSound
      | Phaser.Sound.WebAudioSound;
    if (!this.music.isPlaying) this.music.play();
    this.applyVolume(status);
  }

  getSnapshot(): MusicSnapshot {
    return {
      loaded: this.scene.cache.audio.exists(MUSIC_KEY),
      playing: this.music?.isPlaying ?? false,
      volume: this.music?.volume ?? 0,
      muted: this.muted,
    };
  }

  private applyVolume(status: GameStatus): void {
    if (!this.music) return;
    const contextVolume =
      status === "paused" || status === "contractSelect"
        ? 0.32
        : status === "title" || status === "weaponSelect"
          ? 0.55
          : 0.78;
    this.music.setVolume(this.muted ? 0 : this.volume * contextVolume);
  }
}
