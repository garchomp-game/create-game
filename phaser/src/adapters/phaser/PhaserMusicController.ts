import type * as Phaser from "phaser";
import type { ProfileSettings } from "../../domain/profile";
import type {
  ExpeditionOutcome,
  GameStatus,
} from "../../domain/types";

const MUSIC_TRACKS = {
  arena: { assetKey: "bgmEndless", loop: true },
  victory: { assetKey: "bgmVictory", loop: true },
} as const;

export type MusicTrackId = keyof typeof MUSIC_TRACKS;

export type MusicSnapshot = {
  loaded: boolean;
  playing: boolean;
  track: MusicTrackId | null;
  volume: number;
  muted: boolean;
};

type PhaserMusic = Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound;

export class PhaserMusicController {
  private readonly sounds = new Map<MusicTrackId, PhaserMusic>();
  private activeTrack: MusicTrackId | null = null;
  private volume = 1;
  private muted = false;
  private status: GameStatus = "title";

  constructor(private readonly scene: Phaser.Scene) {}

  configure(settings: Pick<ProfileSettings, "bgmVolume" | "bgmMuted">): void {
    this.volume = settings.bgmVolume;
    this.muted = settings.bgmMuted;
    this.applyVolume(this.status);
  }

  sync(status: GameStatus, expeditionOutcome: ExpeditionOutcome | null = null): void {
    this.status = status;
    const desiredTrack = resolveTrack(status, expeditionOutcome);
    if (desiredTrack !== this.activeTrack) {
      this.stopActiveTrack();
    }
    if (desiredTrack === null) return;

    const definition = MUSIC_TRACKS[desiredTrack];
    if (
      this.scene.sound.locked ||
      !this.scene.cache.audio.exists(definition.assetKey)
    ) {
      return;
    }

    let music = this.sounds.get(desiredTrack);
    if (!music) {
      music = this.scene.sound.add(definition.assetKey, {
        loop: definition.loop,
      }) as PhaserMusic;
      this.sounds.set(desiredTrack, music);
    }
    this.activeTrack = desiredTrack;
    if (!music.isPlaying) music.play();
    this.applyVolume(status);
  }

  getSnapshot(): MusicSnapshot {
    const music = this.activeTrack ? this.sounds.get(this.activeTrack) : null;
    return {
      loaded: Object.values(MUSIC_TRACKS).every((track) =>
        this.scene.cache.audio.exists(track.assetKey),
      ),
      playing: music?.isPlaying ?? false,
      track: this.activeTrack,
      volume: music?.volume ?? 0,
      muted: this.muted,
    };
  }

  private stopActiveTrack(): void {
    if (!this.activeTrack) return;
    const music = this.sounds.get(this.activeTrack);
    if (music?.isPlaying) music.stop();
    this.activeTrack = null;
  }

  private applyVolume(status: GameStatus): void {
    const music = this.activeTrack ? this.sounds.get(this.activeTrack) : null;
    if (!music) return;
    const contextVolume =
      status === "paused" ||
      status === "contractSelect" ||
      status === "trainingBriefing"
        ? 0.32
        : status === "title" || status === "weaponSelect"
          ? 0.55
          : status === "gameOver"
            ? 0.72
            : 0.78;
    music.setVolume(this.muted ? 0 : this.volume * contextVolume);
  }
}

function resolveTrack(
  status: GameStatus,
  expeditionOutcome: ExpeditionOutcome | null,
): MusicTrackId | null {
  if (status !== "gameOver") return "arena";
  return expeditionOutcome === "victory" ? "victory" : null;
}
