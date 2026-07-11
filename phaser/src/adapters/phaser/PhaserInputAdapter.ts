import Phaser from "phaser";
import type { GameStatus, InputSnapshot, Vec2 } from "../../domain/types";
import { normalize } from "../../math/vector";
import {
  findMenuActionAt,
  findUpgradeChoiceAt,
  getMenuButtons,
} from "./PhaserMenuLayout";
import type { MenuAction, SecondaryMenu } from "./PhaserMenuLayout";

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
  private currentCursor = "";
  private pendingMenuAction: MenuAction | null = null;
  private focusedMenuIndex = 0;
  private menuContextKey = "";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Phaser keyboard input is not available.");
    }
    this.setCursor("default");

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
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() || pointer.button === 0) this.pointerPressed = true;
    });
  }

  read(
    status: GameStatus,
    upgradeChoiceCount: number,
    autoFireEnabled = true,
    secondaryMenu: SecondaryMenu | null = null,
  ): InputSnapshot {
    const pointer = this.scene.input.activePointer;
    const pointerPressed = this.pointerPressed;
    this.pointerPressed = false;
    this.syncCursor(status, upgradeChoiceCount, secondaryMenu);
    if (status !== "playing") {
      this.hasPointerAim = false;
    }
    const pointerAimsThisFrame =
      this.hasPointerAim ||
      (status === "playing" && (pointer.leftButtonDown() || pointerPressed));
    const menuButtons = getMenuButtons(
      status,
      this.scene.scale.gameSize.width,
      this.scene.scale.gameSize.height,
      undefined,
      secondaryMenu,
    );
    this.syncMenuFocus(status, secondaryMenu, menuButtons.length);
    const hoveredAction = findMenuActionAt(
      status,
      this.scene.scale.gameSize.width,
      this.scene.scale.gameSize.height,
      pointer.x,
      pointer.y,
      secondaryMenu,
    );
    if (hoveredAction) {
      const hoveredIndex = menuButtons.findIndex((button) => button.action === hoveredAction);
      if (hoveredIndex >= 0) this.focusedMenuIndex = hoveredIndex;
    }
    if (menuButtons.length > 0) {
      if (
        Phaser.Input.Keyboard.JustDown(this.keys.up) ||
        Phaser.Input.Keyboard.JustDown(this.keys.arrowUp)
      ) {
        this.focusedMenuIndex =
          (this.focusedMenuIndex - 1 + menuButtons.length) % menuButtons.length;
      }
      if (
        Phaser.Input.Keyboard.JustDown(this.keys.down) ||
        Phaser.Input.Keyboard.JustDown(this.keys.arrowDown)
      ) {
        this.focusedMenuIndex = (this.focusedMenuIndex + 1) % menuButtons.length;
      }
    }
    const keyboardActivated =
      menuButtons.length > 0 &&
      (Phaser.Input.Keyboard.JustDown(this.keys.start) ||
        (status === "title" &&
          secondaryMenu === null &&
          Phaser.Input.Keyboard.JustDown(this.keys.shoot)));
    const backActivated =
      secondaryMenu !== null && Phaser.Input.Keyboard.JustDown(this.keys.escape);
    const menuAction = backActivated
      ? "back"
      : pointerPressed
        ? hoveredAction
        : keyboardActivated
          ? menuButtons[this.focusedMenuIndex]?.action ?? null
          : null;
    this.pendingMenuAction = menuAction;
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
    const startPressed = menuAction === "start";

    return {
      move: this.readMove(),
      aimWorld: pointerAimsThisFrame ? { x: pointer.x, y: pointer.y } : null,
      startPressed,
      shootHeld:
        this.keys.shoot.isDown ||
        pointer.leftButtonDown() ||
        (status === "playing" && pointerPressed) ||
        (autoFireEnabled && status === "playing" && this.hasPointerAim),
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

  consumeMenuAction(): MenuAction | null {
    const action = this.pendingMenuAction;
    this.pendingMenuAction = null;
    return action;
  }

  getFocusedMenuAction(
    status: GameStatus,
    secondaryMenu: SecondaryMenu | null = null,
  ): MenuAction | null {
    const buttons = getMenuButtons(
      status,
      this.scene.scale.gameSize.width,
      this.scene.scale.gameSize.height,
      undefined,
      secondaryMenu,
    );
    return buttons[this.focusedMenuIndex]?.action ?? null;
  }

  getPointerWorld(): Vec2 | null {
    if (!this.hasPointerAim) return null;

    const pointer = this.scene.input.activePointer;
    return { x: pointer.x, y: pointer.y };
  }

  clearTransientInput(): void {
    this.pointerPressed = false;
    this.hasPointerAim = false;
    this.pendingMenuAction = null;
  }

  syncCursor(
    status: GameStatus,
    upgradeChoiceCount: number,
    secondaryMenu: SecondaryMenu | null = null,
  ): void {
    const pointer = this.scene.input.activePointer;
    this.updateCursor(status, upgradeChoiceCount, pointer.x, pointer.y, secondaryMenu);
  }

  private updateCursor(
    status: GameStatus,
    upgradeChoiceCount: number,
    pointerX: number,
    pointerY: number,
    secondaryMenu: SecondaryMenu | null,
  ): void {
    if (status === "playing" && secondaryMenu === null) {
      this.setCursor("none");
      return;
    }

    const arenaWidth = this.scene.scale.gameSize.width;
    const arenaHeight = this.scene.scale.gameSize.height;
    const overMenuButton =
      findMenuActionAt(
        status,
        arenaWidth,
        arenaHeight,
        pointerX,
        pointerY,
        secondaryMenu,
      ) !== null;
    const overUpgradeChoice =
      status === "upgradeSelect" &&
      findUpgradeChoiceAt(upgradeChoiceCount, arenaWidth, arenaHeight, pointerX, pointerY) !== null;

    this.setCursor(overMenuButton || overUpgradeChoice ? "pointer" : "default");
  }

  private syncMenuFocus(
    status: GameStatus,
    secondaryMenu: SecondaryMenu | null,
    buttonCount: number,
  ): void {
    const key = `${status}:${secondaryMenu ?? "primary"}`;
    if (key !== this.menuContextKey) {
      this.menuContextKey = key;
      this.focusedMenuIndex = 0;
    }
    if (buttonCount === 0) this.focusedMenuIndex = 0;
    else this.focusedMenuIndex = Math.min(this.focusedMenuIndex, buttonCount - 1);
  }

  private setCursor(cursor: string): void {
    if (this.currentCursor === cursor) return;

    this.scene.input.setDefaultCursor(cursor);
    this.currentCursor = cursor;
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
