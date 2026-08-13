import { describe, expect, it, vi } from "vitest";

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

    fake.movePointer(480, 314);
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
