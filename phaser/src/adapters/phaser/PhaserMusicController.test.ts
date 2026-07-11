import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { PhaserMusicController } from "./PhaserMusicController";

describe("PhaserMusicController", () => {
  it("applies context volume and reuses one looping sound across screen transitions", () => {
    const fixture = createFixture();
    const controller = new PhaserMusicController(fixture.scene);

    controller.configure({ bgmVolume: 1, bgmMuted: false });
    controller.sync("title");
    expect(fixture.addCalls).toBe(1);
    expect(fixture.music.playCalls).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({ playing: true, volume: 0.55 });

    controller.sync("playing");
    expect(fixture.addCalls).toBe(1);
    expect(fixture.music.playCalls).toBe(1);
    expect(controller.getSnapshot().volume).toBe(0.78);

    controller.sync("paused");
    expect(controller.getSnapshot().volume).toBe(0.32);

    controller.sync("gameOver");
    expect(fixture.music.stopCalls).toBe(1);
    expect(controller.getSnapshot().playing).toBe(false);

    controller.sync("playing");
    expect(fixture.addCalls).toBe(1);
    expect(fixture.music.playCalls).toBe(2);
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
    expect(fixture.addCalls).toBe(0);
    expect(controller.getSnapshot()).toMatchObject({ loaded: true, playing: false });

    fixture.sound.locked = false;
    controller.sync("title");
    expect(fixture.addCalls).toBe(1);
    expect(controller.getSnapshot().playing).toBe(true);
  });
});

function createFixture() {
  const music = {
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
  const sound = {
    locked: false,
    add: () => {
      fixture.addCalls += 1;
      return music;
    },
  };
  const fixture = {
    addCalls: 0,
    music,
    sound,
    scene: {
      sound,
      cache: { audio: { exists: () => true } },
    } as unknown as Phaser.Scene,
  };
  return fixture;
}
