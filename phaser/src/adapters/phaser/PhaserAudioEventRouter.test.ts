import { describe, expect, it } from "vitest";
import type * as Phaser from "phaser";
import { PhaserAudioEventRouter } from "./PhaserAudioEventRouter";

describe("PhaserAudioEventRouter", () => {
  it("routes cues with cooldowns and keeps cue telemetry while muted", () => {
    const played: Array<{ key: string; volume: number; detune?: number }> = [];
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => true } },
      sound: {
        play: (key: string, options: { volume: number; detune?: number }) => {
          played.push({ key, volume: options.volume, detune: options.detune });
        },
      },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene);

    router.configure({ sfxVolume: 0.5, sfxMuted: false });
    router.handleEvents([{ type: "game.over", score: 100, elapsed: 10 }]);
    router.handleEvents([{ type: "game.over", score: 100, elapsed: 10 }]);
    expect(played).toEqual([{ key: "gameOver", volume: 0.22, detune: 0 }]);

    scene.time.now = 500;
    router.configure({ sfxVolume: 1, sfxMuted: true });
    router.handleEvents([{ type: "game.over", score: 200, elapsed: 20 }]);
    expect(played).toHaveLength(1);
    expect(router.getLastCues()).toEqual(["gameOver", "gameOver", "gameOver"]);
  });

  it("cycles high-frequency cue variants and resets the sequence between runs", () => {
    const played: Array<{ key: string; detune?: number }> = [];
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => true } },
      sound: {
        play: (key: string, options: { detune?: number }) => {
          played.push({ key, detune: options.detune });
        },
      },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene);
    const shot = {
      type: "shot.fired" as const,
      volleyId: 1,
      bulletIds: ["bullet-1"],
      weaponType: "pulse" as const,
      position: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
      projectileCount: 1,
    };

    router.configure({ sfxVolume: 1, sfxMuted: false });
    for (const now of [100, 200, 300, 400]) {
      scene.time.now = now;
      router.handleEvents([shot]);
    }
    expect(played).toEqual([
      { key: "shot", detune: 0 },
      { key: "shotAlt1", detune: 22 },
      { key: "shotAlt2", detune: -18 },
      { key: "shot", detune: 0 },
    ]);

    router.reset();
    scene.time.now = 500;
    router.handleEvents([shot]);
    expect(played.at(-1)).toEqual({ key: "shot", detune: 0 });
  });

  it("gives Spread sweep a distinct cue without adding another audio asset", () => {
    const played: Array<{ key: string; volume: number; detune?: number }> = [];
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => true } },
      sound: {
        play: (key: string, options: { volume: number; detune?: number }) => {
          played.push({ key, volume: options.volume, detune: options.detune });
        },
      },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene);

    router.configure({ sfxVolume: 1, sfxMuted: false });
    router.handleEvents([
      { type: "spread.sweep.triggered", volleyId: 7, distinctTargets: 3 },
    ]);

    expect(played).toEqual([{ key: "upgrade", volume: 0.26, detune: 120 }]);
    expect(router.getLastCues()).toEqual(["sweep"]);
  });

  it("uses the victory cue path without layering the defeat sound", () => {
    const played: string[] = [];
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => true } },
      sound: { play: (key: string) => played.push(key) },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene);

    router.handleEvents([
      {
        type: "expedition.completed",
        actId: "command-ship",
        elapsed: 420,
        score: 40_000,
        scoreBeforeBonus: 25_000,
        clearScoreBonus: 15_000,
        timeScoreBonus: 0,
        bossFightDuration: 120,
      },
      { type: "game.over", score: 40_000, elapsed: 420 },
    ]);

    expect(played).toEqual(["upgrade"]);
    expect(router.getLastCues()).toEqual(["sweep"]);
  });
});
