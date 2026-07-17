import { describe, expect, it } from "vitest";
import type * as Phaser from "phaser";
import { PhaserMusicController } from "./PhaserMusicController";

describe("PhaserMusicController", () => {
  it("applies context volume and reuses the arena loop across screen transitions", () => {
    const fixture = createFixture();
    const controller = new PhaserMusicController(fixture.scene);

    controller.configure({ bgmVolume: 1, bgmMuted: false });
    controller.sync("title");
    expect(fixture.addCalls).toEqual([{ key: "bgmEndless", loop: true }]);
    expect(fixture.arena.playCalls).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      playing: true,
      track: "arena",
      volume: 0.55,
    });

    controller.sync("playing");
    expect(fixture.addCalls).toHaveLength(1);
    expect(fixture.arena.playCalls).toBe(1);
    expect(controller.getSnapshot().volume).toBe(0.78);

    controller.sync("paused");
    expect(controller.getSnapshot().volume).toBe(0.32);

    controller.sync("gameOver");
    expect(fixture.arena.stopCalls).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      playing: false,
      track: null,
    });

    controller.sync("playing");
    expect(fixture.addCalls).toHaveLength(1);
    expect(fixture.arena.playCalls).toBe(2);
  });

  it("switches an Expedition victory to its dedicated result loop", () => {
    const fixture = createFixture();
    const controller = new PhaserMusicController(fixture.scene);

    controller.sync("playing");
    controller.sync("gameOver", "victory");

    expect(fixture.arena.stopCalls).toBe(1);
    expect(fixture.victory.playCalls).toBe(1);
    expect(fixture.addCalls).toEqual([
      { key: "bgmEndless", loop: true },
      { key: "bgmVictory", loop: true },
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      playing: true,
      track: "victory",
      volume: 0.72,
    });

    controller.sync("title", "victory");
    expect(fixture.victory.stopCalls).toBe(1);
    expect(fixture.arena.playCalls).toBe(2);
    expect(controller.getSnapshot().track).toBe("arena");
  });

  it("reflects mute and volume changes immediately in the current context", () => {
    const fixture = createFixture();
    const controller = new PhaserMusicController(fixture.scene);
    controller.sync("paused");

    controller.configure({ bgmVolume: 0.5, bgmMuted: false });
    expect(controller.getSnapshot().volume).toBe(0.16);

    controller.configure({ bgmVolume: 0.5, bgmMuted: true });
    expect(controller.getSnapshot()).toMatchObject({ volume: 0, muted: true });
  });

  it("waits for browser audio unlock before creating or playing music", () => {
    const fixture = createFixture();
    fixture.sound.locked = true;
    const controller = new PhaserMusicController(fixture.scene);

    controller.sync("title");
    expect(fixture.addCalls).toHaveLength(0);
    expect(controller.getSnapshot()).toMatchObject({ loaded: true, playing: false });

    fixture.sound.locked = false;
    controller.sync("title");
    expect(fixture.addCalls).toHaveLength(1);
    expect(controller.getSnapshot().playing).toBe(true);
  });
});

function createFixture() {
  const arena = createSound();
  const victory = createSound();
  const fixture = {
    addCalls: [] as Array<{ key: string; loop: boolean }>,
    arena,
    victory,
    sound: {
      locked: false,
      add: (key: string, options: { loop: boolean }) => {
        fixture.addCalls.push({ key, loop: options.loop });
        return key === "bgmVictory" ? victory : arena;
      },
    },
    scene: null as unknown as Phaser.Scene,
  };
  fixture.scene = {
    sound: fixture.sound,
    cache: { audio: { exists: () => true } },
  } as unknown as Phaser.Scene;
  return fixture;
}

function createSound() {
  return {
    isPlaying: false,
    volume: 0,
    playCalls: 0,
    stopCalls: 0,
    play() {
      this.isPlaying = true;
      this.playCalls += 1;
      this.volume = 1;
    },
    stop() {
      this.isPlaying = false;
      this.stopCalls += 1;
    },
    setVolume(volume: number) {
      this.volume = volume;
      return this;
    },
  };
}
