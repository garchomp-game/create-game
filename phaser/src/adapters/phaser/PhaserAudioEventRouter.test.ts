import { describe, expect, it } from "vitest";
import type * as Phaser from "phaser";
import { toExProtocolId } from "../../content/exProtocolCatalog";
import { PhaserAudioEventRouter } from "./PhaserAudioEventRouter";

describe("PhaserAudioEventRouter", () => {
  it("keeps routing observations opt-in for the production path", () => {
    const played: string[] = [];
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => true } },
      sound: { play: (key: string) => played.push(key) },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene);

    router.handleEvents([{ type: "game.over", score: 100, elapsed: 10 }]);

    expect(played).toEqual(["gameOver"]);
    expect(router.getLastCues()).toEqual(["gameOver"]);
    expect(router.getRoutingSnapshot()).toEqual({
      requested: [],
      played: [],
      suppressed: [],
    });
  });

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
    const router = new PhaserAudioEventRouter(scene, true);

    router.configure({ sfxVolume: 0.5, sfxMuted: false });
    router.handleEvents([{ type: "game.over", score: 100, elapsed: 10 }]);
    router.handleEvents([{ type: "game.over", score: 100, elapsed: 10 }]);
    expect(played).toEqual([{ key: "gameOver", volume: 0.22, detune: 0 }]);

    scene.time.now = 500;
    router.configure({ sfxVolume: 1, sfxMuted: true });
    router.handleEvents([{ type: "game.over", score: 200, elapsed: 20 }]);
    expect(played).toHaveLength(1);
    expect(router.getLastCues()).toEqual(["gameOver", "gameOver", "gameOver"]);
    expect(router.getRoutingSnapshot()).toEqual({
      requested: [
        {
          sequence: 0,
          eventType: "game.over",
          cue: "gameOver",
          requestedAtMs: 100,
        },
        {
          sequence: 1,
          eventType: "game.over",
          cue: "gameOver",
          requestedAtMs: 100,
        },
        {
          sequence: 2,
          eventType: "game.over",
          cue: "gameOver",
          requestedAtMs: 500,
        },
      ],
      played: [
        {
          sequence: 0,
          eventType: "game.over",
          cue: "gameOver",
          requestedAtMs: 100,
          asset: "gameOver",
          volume: 0.22,
          detune: 0,
        },
      ],
      suppressed: [
        {
          sequence: 1,
          eventType: "game.over",
          cue: "gameOver",
          requestedAtMs: 100,
          reason: "cooldown",
        },
        {
          sequence: 2,
          eventType: "game.over",
          cue: "gameOver",
          requestedAtMs: 500,
          reason: "muted",
        },
      ],
    });
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
    const router = new PhaserAudioEventRouter(scene, true);
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
    const router = new PhaserAudioEventRouter(scene, true);

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
    const router = new PhaserAudioEventRouter(scene, true);

    router.handleEvents([
      {
        type: "expedition.completed",
        actId: "command-ship",
        elapsed: 420,
        score: 40_000,
        tacticalScore: 25_000,
        scoreBeforeBonus: 25_000,
        clearScoreBonus: 15_000,
        timeScoreBonus: 0,
        timeMedal: "gold",
        bossFightDuration: 120,
      },
      { type: "game.over", score: 40_000, elapsed: 420 },
    ]);

    expect(played).toEqual(["upgrade"]);
    expect(router.getLastCues()).toEqual(["sweep"]);
    expect(router.getRoutingSnapshot()).toMatchObject({
      requested: [
        { sequence: 0, cue: "sweep", eventType: "expedition.completed" },
        { sequence: 1, cue: "gameOver", eventType: "game.over" },
      ],
      played: [{ sequence: 0, cue: "sweep", asset: "upgrade" }],
      suppressed: [
        {
          sequence: 1,
          cue: "gameOver",
          reason: "victory-terminal-dedup",
        },
      ],
    });
  });

  it("routes distinct EX Protocol readiness, activation, guard, and rejection cues", () => {
    const played: string[] = [];
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => true } },
      sound: { play: (key: string) => played.push(key) },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene, true);
    const rebound = toExProtocolId("pulse.rebound-overdrive");

    router.handleEvents([
      {
        type: "ex.protocol.selected",
        weaponId: "pulse",
        protocolId: rebound,
        interaction: "active",
        exLevel: 0,
        elapsed: 1,
      },
      {
        type: "ex.special.activated",
        protocolId: rebound,
        activationId: 1,
        elapsed: 2,
      },
      {
        type: "ex.aegis.intercepted",
        volleyId: 2,
        side: "left",
        enemyProjectileCategory: "standard",
        plannedPlayerEndpointContact: true,
        elapsed: 3,
      },
      {
        type: "ex.special.rejected",
        protocolId: rebound,
        reason: "cooldown",
        elapsed: 4,
      },
    ]);

    expect(played).toEqual([
      "protocolReady",
      "protocolActivate",
      "protocolGuard",
      "protocolReject",
    ]);
    expect(router.getLastCues()).toEqual([
      "protocolReady",
      "protocolActivate",
      "protocolGuard",
      "protocolReject",
    ]);
  });

  it.each([
    {
      name: "zero volume",
      volume: 0,
      assetAvailable: true,
      reason: "zero-volume",
    },
    {
      name: "missing asset",
      volume: 1,
      assetAvailable: false,
      reason: "asset-unavailable",
    },
  ] as const)("records $name suppression", ({ volume, assetAvailable, reason }) => {
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => assetAvailable } },
      sound: { play: () => undefined },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene, true);

    router.configure({ sfxVolume: volume, sfxMuted: false });
    router.handleEvents([{ type: "game.over", score: 100, elapsed: 10 }]);

    expect(router.getRoutingSnapshot()).toMatchObject({
      requested: [{ sequence: 0, cue: "gameOver" }],
      played: [],
      suppressed: [{ sequence: 0, cue: "gameOver", reason }],
    });
  });

  it("bounds routing observations independently from legacy cue history", () => {
    const scene = {
      time: { now: 100 },
      cache: { audio: { exists: () => true } },
      sound: { play: () => undefined },
    } as unknown as Phaser.Scene;
    const router = new PhaserAudioEventRouter(scene, true);
    router.configure({ sfxVolume: 1, sfxMuted: true });

    for (let index = 0; index < 45; index += 1) {
      router.handleEvents([{ type: "game.over", score: index, elapsed: index }]);
    }

    const routing = router.getRoutingSnapshot();
    expect(router.getLastCues()).toHaveLength(20);
    expect(routing.requested).toHaveLength(40);
    expect(routing.suppressed).toHaveLength(40);
    expect(routing.requested[0]?.sequence).toBe(5);
    expect(routing.requested.at(-1)?.sequence).toBe(44);
  });
});
