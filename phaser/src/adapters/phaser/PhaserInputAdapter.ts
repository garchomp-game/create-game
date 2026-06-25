import Phaser from "phaser";
import type { GameStatus, InputSnapshot, Vec2 } from "../../domain/types";
import { normalize } from "../../math/vector";
import { findMenuActionAt, findUpgradeChoiceAt } from "./PhaserMenuLayout";

type ArenaKeys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  arrowUp: Phaser.Input.Keyboard.Key;
  arrowDown: Phaser.Input.Keyboard.Key;
  arrowLeft: Phaser.Input.Keyboard.Key;
  arrowRight: Phaser.Input.Keyboard.Key;
  shoot: Phaser.Input.Keyboard.Key;
  start: Phaser.Input.Keyboard.Key;
  restart: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
  quitToTitle: Phaser.Input.Keyboard.Key;
  escape: Phaser.Input.Keyboard.Key;
  upgrade1: Phaser.Input.Keyboard.Key;
  upgrade2: Phaser.Input.Keyboard.Key;
  upgrade3: Phaser.Input.Keyboard.Key;
  debug: Phaser.Input.Keyboard.Key;
};

export class PhaserInputAdapter {
  private readonly scene: Phaser.Scene;
  private readonly keys: ArenaKeys;
  private hasPointerAim = false;
  private pointerPressed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Phaser keyboard input is not available.");
    }
    scene.input.setDefaultCursor("none");

    this.keys = keyboard.addKeys({
      up: "W",
      down: "S",
      left: "A",
      right: "D",
      arrowUp: "UP",
      arrowDown: "DOWN",
      arrowLeft: "LEFT",
      arrowRight: "RIGHT",
      shoot: "SPACE",
      start: "ENTER",
      restart: "R",
      pause: "P",
      quitToTitle: "Q",
      escape: "ESC",
      upgrade1: "ONE",
      upgrade2: "TWO",
      upgrade3: "THREE",
      debug: "F3",
    }) as ArenaKeys;

    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.ESC,
    ]);

    scene.input.on(Phaser.Input.Events.POINTER_MOVE, () => {
      this.hasPointerAim = true;
    });
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.hasPointerAim = true;
      this.pointerPressed = true;
    });
  }

  read(status: GameStatus, upgradeChoiceCount: number): InputSnapshot {
    const pointer = this.scene.input.activePointer;
    const pointerPressed = this.pointerPressed;
    this.pointerPressed = false;
    const menuAction = pointerPressed
      ? findMenuActionAt(
          status,
          this.scene.scale.gameSize.width,
          this.scene.scale.gameSize.height,
          pointer.x,
          pointer.y,
        )
      : null;
    const clickedUpgradeChoice =
      pointerPressed && status === "upgradeSelect"
        ? findUpgradeChoiceAt(
            upgradeChoiceCount,
            this.scene.scale.gameSize.width,
            this.scene.scale.gameSize.height,
            pointer.x,
            pointer.y,
          )
        : null;
    const startPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.start) ||
      Phaser.Input.Keyboard.JustDown(this.keys.shoot) ||
      menuAction === "start";

    return {
      move: this.readMove(),
      aimWorld: this.hasPointerAim ? { x: pointer.x, y: pointer.y } : null,
      startPressed,
      shootHeld: this.keys.shoot.isDown || pointer.isDown,
      restartPressed:
        Phaser.Input.Keyboard.JustDown(this.keys.restart) || menuAction === "restart",
      pausePressed:
        Phaser.Input.Keyboard.JustDown(this.keys.pause) ||
        Phaser.Input.Keyboard.JustDown(this.keys.escape) ||
        menuAction === "resume",
      quitToTitlePressed:
        Phaser.Input.Keyboard.JustDown(this.keys.quitToTitle) || menuAction === "title",
      upgradeChoicePressed: clickedUpgradeChoice ?? this.readUpgradeChoice(),
    };
  }

  readDebugTogglePressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.debug);
  }

  getPointerWorld(): Vec2 | null {
    if (!this.hasPointerAim) return null;

    const pointer = this.scene.input.activePointer;
    return { x: pointer.x, y: pointer.y };
  }

  clearTransientInput(): void {
    this.pointerPressed = false;
  }

  private readMove(): Vec2 {
    let dx = 0;
    let dy = 0;

    if (this.keys.left.isDown || this.keys.arrowLeft.isDown) dx -= 1;
    if (this.keys.right.isDown || this.keys.arrowRight.isDown) dx += 1;
    if (this.keys.up.isDown || this.keys.arrowUp.isDown) dy -= 1;
    if (this.keys.down.isDown || this.keys.arrowDown.isDown) dy += 1;

    return normalize(dx, dy);
  }

  private readUpgradeChoice(): number | null {
    if (Phaser.Input.Keyboard.JustDown(this.keys.upgrade1)) return 0;
    if (Phaser.Input.Keyboard.JustDown(this.keys.upgrade2)) return 1;
    if (Phaser.Input.Keyboard.JustDown(this.keys.upgrade3)) return 2;
    return null;
  }
}
