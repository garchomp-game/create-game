import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Input: {
    Events: {
      POINTER_MOVE: "pointermove",
      POINTER_DOWN: "pointerdown",
    },
    Keyboard: {
      JustDown: (key: FakeKey) => {
        const justDown = key.justDown;
        key.justDown = false;
        return justDown;
      },
      KeyCodes: {
        SPACE: 32,
        ENTER: 13,
        UP: 38,
        DOWN: 40,
        LEFT: 37,
        RIGHT: 39,
        ESC: 27,
        H: 72,
        E: 69,
      },
    },
  },
}));

import { PhaserInputAdapter } from "./PhaserInputAdapter";

let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

describe("PhaserInputAdapter menu focus", () => {
  it("does not let a stale pointer steal focus after the menu context changes", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);

    fake.movePointer(480, 314);
    fake.pressPointer();
    adapter.read("title", 0);
    expect(adapter.consumeMenuAction()).toBe("story");

    adapter.read("title", 0, true, "story");
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startTraining");

    fake.movePointer(500, 314);
    adapter.read("title", 0, true, "story");
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startExpedition");
  });

  it("keeps keyboard focus until a real pointer event occurs", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);

    adapter.read("title", 0);
    expect(adapter.getFocusedMenuAction("title")).toBe("story");

    fake.keys.arrowDown.justDown = true;
    adapter.read("title", 0);
    expect(adapter.getFocusedMenuAction("title")).toBe("start");

    fake.pointer.x = 480;
    fake.pointer.y = 314;
    adapter.read("title", 0);
    expect(adapter.getFocusedMenuAction("title")).toBe("start");
  });
});

describe("PhaserInputAdapter cross-menu activation bursts", () => {
  it("blocks a same-position double click and its hover focus until 300ms", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    clickTitleStory(fake, adapter);

    now = 120;
    adapter.read("title", 0, true, "story");
    fake.movePointer(480, 319);
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBeNull();
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startTraining");

    now = 299;
    fake.movePointer(488, 314);
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBeNull();
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startTraining");

    now = 598;
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBeNull();

    now = 897;
    fake.movePointer(487, 314);
    adapter.read("title", 0, true, "story");
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startTraining");

    now = 898;
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("startExpedition");
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startExpedition");
  });

  it("allows deliberate movement over 8px even when the pointer returns before the next frame", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    clickTitleStory(fake, adapter);
    now = 20;
    fake.movePointer(489, 314);
    fake.movePointer(480, 314);
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("startExpedition");
  });

  it("allows immediate pointer-to-keyboard selection without moving focus to a blocked click", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    clickTitleStory(fake, adapter);
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBeNull();
    fake.keys.start.justDown = true;
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("startTraining");
  });

  it("allows immediate keyboard-to-pointer selection", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    fake.keys.start.justDown = true;
    adapter.read("title", 0);
    expect(adapter.consumeMenuAction()).toBe("story");
    fake.movePointer(480, 314);
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("startExpedition");
  });

  it("blocks rapid Enter presses across contexts but accepts explicit arrow selection", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    fake.keys.start.justDown = true;
    adapter.read("title", 0);
    expect(adapter.consumeMenuAction()).toBe("story");
    now = 120;
    fake.keys.start.justDown = true;
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBeNull();
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startTraining");
    fake.keys.arrowDown.justDown = true;
    fake.keys.start.justDown = true;
    adapter.read("title", 0, true, "story");
    expect(adapter.getFocusedMenuAction("title", "story")).toBe("startExpedition");
    expect(adapter.consumeMenuAction()).toBe("startExpedition");
  });

  it("accepts a fresh Enter after the interval and never reuses a held key's consumed JustDown", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    fake.keys.start.isDown = true;
    fake.keys.start.justDown = true;
    adapter.read("title", 0);
    expect(adapter.consumeMenuAction()).toBe("story");
    // Phaser Key.onDown does not set JustDown again for native key repeat.
    for (now of [100, 300, 800]) {
      adapter.read("title", 0, true, "story");
      expect(adapter.consumeMenuAction()).toBeNull();
    }
    fake.keys.start.isDown = false;
    fake.keys.start.justDown = true;
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("startTraining");
  });

  it("keeps a continuing Enter burst blocked until 300ms after its last press", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    fake.keys.start.justDown = true;
    adapter.read("title", 0);
    expect(adapter.consumeMenuAction()).toBe("story");
    for (now of [120, 299, 598]) {
      fake.keys.start.justDown = true;
      adapter.read("title", 0, true, "story");
      expect(adapter.consumeMenuAction()).toBeNull();
    }
    now = 898;
    fake.keys.start.justDown = true;
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("startTraining");
  });

  it("allows Escape and immediately rearms the returned menu", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    fake.keys.start.justDown = true;
    adapter.read("title", 0);
    expect(adapter.consumeMenuAction()).toBe("story");
    fake.keys.escape.justDown = true;
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("back");
    fake.keys.start.justDown = true;
    adapter.read("title", 0);
    expect(adapter.consumeMenuAction()).toBe("story");
  });

  it("preserves repeated settings actions within the same context", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    fake.movePointer(480, 258);
    for (let index = 0; index < 2; index += 1) {
      fake.pressPointer();
      adapter.read("title", 0, true, "settings");
      expect(adapter.consumeMenuAction()).toBe("settingsAutoFire");
    }
  });

  it("keeps pause focus and Enter execution aligned after keyboard navigation", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    fake.movePointer(480, 305);
    adapter.read("paused", 0);
    fake.keys.arrowDown.justDown = true;
    adapter.read("paused", 0);
    adapter.read("paused", 0);
    expect(adapter.getFocusedMenuAction("paused")).toBe("restart");
    fake.keys.start.justDown = true;
    adapter.read("paused", 0);
    expect(adapter.consumeMenuAction()).toBe("restart");
  });

  it("does not guard combat, upgrade, or weapon choice input", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    clickTitleStory(fake, adapter);
    fake.pressPointer();
    expect(adapter.read("playing", 0).shootHeld).toBe(true);
    fake.keys.upgrade1.justDown = true;
    expect(adapter.read("upgradeSelect", 3).upgradeChoicePressed).toBe(0);
    fake.keys.start.justDown = true;
    adapter.read("weaponSelect", 0);
    expect(adapter.consumeMenuAction()).toBe("selectPulse");
  });

  it("clears burst state with transient input reset", () => {
    const fake = createFakeScene();
    const adapter = new PhaserInputAdapter(fake.scene);
    clickTitleStory(fake, adapter);
    adapter.clearTransientInput();
    fake.pressPointer();
    adapter.read("title", 0, true, "story");
    expect(adapter.consumeMenuAction()).toBe("startExpedition");
  });
});

function clickTitleStory(
  fake: ReturnType<typeof createFakeScene>,
  adapter: PhaserInputAdapter,
): void {
  fake.movePointer(480, 314);
  fake.pressPointer();
  adapter.read("title", 0);
  expect(adapter.consumeMenuAction()).toBe("story");
}

type FakeKey = {
  isDown: boolean;
  justDown: boolean;
  reset: () => void;
};

function createFakeScene() {
  const handlers = new Map<string, Array<(pointer?: FakePointer) => void>>();
  const keys = createFakeKeys();
  const pointer: FakePointer = {
    x: 0,
    y: 0,
    button: 0,
    leftButtonDown: () => false,
    rightButtonDown: () => false,
  };
  const keyboard = {
    addKeys: () => keys,
    addCapture: vi.fn(),
    addKey: () => createFakeKey(),
    removeKey: vi.fn(),
  };
  const input = {
    activePointer: pointer,
    keyboard,
    on: (event: string, handler: (pointer?: FakePointer) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    off: vi.fn(),
    setDefaultCursor: vi.fn(),
  };
  const scene = {
    input,
    scale: { gameSize: { width: 960, height: 540 } },
    game: {
      canvas: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    },
  } as unknown as ConstructorParameters<typeof PhaserInputAdapter>[0];

  return {
    scene,
    keys,
    pointer,
    movePointer(x: number, y: number) {
      pointer.x = x;
      pointer.y = y;
      handlers.get("pointermove")?.forEach((handler) => handler(pointer));
    },
    pressPointer() {
      handlers.get("pointerdown")?.forEach((handler) => handler(pointer));
    },
  };
}

type FakePointer = {
  x: number;
  y: number;
  button: number;
  leftButtonDown: () => boolean;
  rightButtonDown: () => boolean;
};

function createFakeKeys(): Record<string, FakeKey> & {
  arrowDown: FakeKey;
} {
  return Object.fromEntries(
    [
      "up",
      "down",
      "left",
      "right",
      "arrowUp",
      "arrowDown",
      "arrowLeft",
      "arrowRight",
      "shoot",
      "start",
      "restart",
      "pause",
      "quitToTitle",
      "escape",
      "upgrade1",
      "upgrade2",
      "upgrade3",
      "autoPilot",
      "debug",
      "help",
    ].map((name) => [name, createFakeKey()]),
  ) as Record<string, FakeKey> & { arrowDown: FakeKey };
}

function createFakeKey(): FakeKey {
  return {
    isDown: false,
    justDown: false,
    reset() {
      this.isDown = false;
      this.justDown = false;
    },
  };
}
