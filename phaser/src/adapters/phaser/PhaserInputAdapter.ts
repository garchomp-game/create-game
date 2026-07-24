import * as Phaser from "phaser";
import type { GameStatus, InputSnapshot, Vec2 } from "../../domain/types";
import type { ChoiceInteractionInputMethod } from "../../application/ChoiceInteractionMonitor";
import { normalize } from "../../math/vector";
import {
  findMenuActionAt,
  findUpgradeChoiceAt,
  getMenuButtons,
} from "./PhaserMenuLayout";
import {
  getHelpHudButtonBounds,
  isPointInHelpBounds,
} from "./PhaserHelpLayout";
import {
  getPracticeSettingsButtonBounds,
  isPointInPracticeControl,
} from "./PhaserPracticeLayout";
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
  autoPilot: Phaser.Input.Keyboard.Key;
  debug: Phaser.Input.Keyboard.Key;
  help: Phaser.Input.Keyboard.Key;
  special?: Phaser.Input.Keyboard.Key;
};

export class PhaserInputAdapter {
  private readonly scene: Phaser.Scene;
  private readonly keys: ArenaKeys;
  private exProtocolInputEnabled = false;
  private hasPointerAim = false;
  private pointerPressed = false;
  private specialPointerPressed = false;
  private currentCursor = "";
  private pendingMenuAction: MenuAction | null = null;
  private pendingChoiceInputMethod: ChoiceInteractionInputMethod | null = null;
  private focusedMenuIndex = 0;
  private menuContextKey = "";

  private readonly handlePointerMove = (): void => {
    this.hasPointerAim = true;
  };

  private readonly handlePointerDown = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (pointer.leftButtonDown() || pointer.button === 0) {
      this.pointerPressed = true;
    }
  };

  private readonly handleSpecialPointerDown = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (!pointer.rightButtonDown() && pointer.button !== 2) return;
    this.hasPointerAim = true;
    this.specialPointerPressed = true;
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly handleWindowBlur = (): void => {
    this.clearTransientInput();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") this.clearTransientInput();
  };

  constructor(scene: Phaser.Scene, exProtocolInputEnabled = false) {
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
      autoPilot: "O",
      debug: "F3",
      help: "H",
    }) as ArenaKeys;

    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.ESC,
      Phaser.Input.Keyboard.KeyCodes.H,
    ]);

    scene.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      this.handlePointerMove,
    );
    scene.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
    );
    this.configureExProtocolInput(exProtocolInputEnabled);
  }

  configureExProtocolInput(enabled: boolean): void {
    if (enabled === this.exProtocolInputEnabled) return;
    this.clearTransientInput();
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Phaser keyboard input is not available.");
    }
    this.exProtocolInputEnabled = enabled;
    if (enabled) {
      this.keys.special = keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.E,
      );
      keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.E);
      this.scene.input.on(
        Phaser.Input.Events.POINTER_DOWN,
        this.handleSpecialPointerDown,
      );
      this.scene.game.canvas.addEventListener(
        "contextmenu",
        this.handleContextMenu,
      );
      window.addEventListener("blur", this.handleWindowBlur);
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
      return;
    }
    if (this.keys.special) {
      keyboard.removeKey(this.keys.special, true, true);
      delete this.keys.special;
    }
    this.scene.input.off(
      Phaser.Input.Events.POINTER_DOWN,
      this.handleSpecialPointerDown,
    );
    this.scene.game.canvas.removeEventListener(
      "contextmenu",
      this.handleContextMenu,
    );
    window.removeEventListener("blur", this.handleWindowBlur);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
  }

  read(
    status: GameStatus,
    upgradeChoiceCount: number,
    autoFireEnabled = true,
    secondaryMenu: SecondaryMenu | null = null,
    practiceActive = false,
  ): InputSnapshot {
    this.pendingChoiceInputMethod = null;
    const pointer = this.scene.input.activePointer;
    const pointerPressed = this.pointerPressed;
    const specialPointerPressed = this.specialPointerPressed;
    const startJustDown = Phaser.Input.Keyboard.JustDown(this.keys.start);
    const shootJustDown = Phaser.Input.Keyboard.JustDown(this.keys.shoot);
    const helpJustDown = Phaser.Input.Keyboard.JustDown(this.keys.help);
    const arenaWidth = this.scene.scale.gameSize.width;
    const arenaHeight = this.scene.scale.gameSize.height;
    const helpButtonPressed =
      pointerPressed &&
      status === "playing" &&
      secondaryMenu === null &&
      isPointInHelpBounds(
        getHelpHudButtonBounds(arenaWidth, arenaHeight),
        pointer.x,
        pointer.y,
      );
    const practiceSettingsButtonPressed =
      pointerPressed &&
      practiceActive &&
      status === "playing" &&
      secondaryMenu === null &&
      isPointInPracticeControl(
        getPracticeSettingsButtonBounds(arenaWidth),
        pointer.x,
        pointer.y,
      );
    this.pointerPressed = false;
    this.specialPointerPressed = false;
    this.syncCursor(
      status,
      upgradeChoiceCount,
      secondaryMenu,
      practiceActive,
    );
    if (
      status !== "playing" &&
      status !== "upgradeSelect" &&
      status !== "contractSelect"
    ) {
      this.hasPointerAim = false;
    }
    const pointerAimsThisFrame =
      !helpButtonPressed &&
      !practiceSettingsButtonPressed &&
      (this.hasPointerAim ||
        (status === "playing" && (pointer.leftButtonDown() || pointerPressed)));
    const menuButtons = getMenuButtons(
      status,
      arenaWidth,
      arenaHeight,
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
      (startJustDown ||
        (status === "title" && secondaryMenu === null && shootJustDown));
    const backActivated =
      (secondaryMenu !== null ||
        status === "weaponSelect" ||
        status === "trainingComplete") &&
      Phaser.Input.Keyboard.JustDown(this.keys.escape);
    const helpAvailable =
      secondaryMenu === "settings" ||
      secondaryMenu === "help" ||
      status === "playing" ||
      status === "paused";
    const helpAction =
      helpButtonPressed || (helpAvailable && helpJustDown)
        ? secondaryMenu === "help"
          ? "back"
          : "help"
        : null;
    const menuAction =
      (practiceSettingsButtonPressed ? "practiceSettings" : null) ??
      helpAction ??
      (backActivated
        ? "back"
        : pointerPressed
          ? hoveredAction
          : keyboardActivated
            ? menuButtons[this.focusedMenuIndex]?.action ?? null
            : null);
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
    const keyboardUpgradeChoice = this.readUpgradeChoice();
    const startPressed = menuAction === "start";
    const tutorialContinuePressed =
      status === "trainingBriefing" &&
      (startJustDown || shootJustDown);
    const contractChoicePressed =
      menuAction === "contractStandard"
        ? 0
        : menuAction === "contractOverdrive"
          ? 1
          : null;
    if (clickedUpgradeChoice !== null) {
      this.pendingChoiceInputMethod = "pointer";
    } else if (keyboardUpgradeChoice !== null) {
      this.pendingChoiceInputMethod = "keyboard";
    } else if (contractChoicePressed !== null) {
      this.pendingChoiceInputMethod = pointerPressed ? "pointer" : "keyboard";
    }
    const pausePressed =
      Phaser.Input.Keyboard.JustDown(this.keys.pause) ||
      Phaser.Input.Keyboard.JustDown(this.keys.escape) ||
      menuAction === "resume";
    const specialKeyboardPressed = this.keys.special
      ? Phaser.Input.Keyboard.JustDown(this.keys.special)
      : false;

    return {
      move: this.readMove(),
      aimWorld: pointerAimsThisFrame ? { x: pointer.x, y: pointer.y } : null,
      startPressed,
      shootHeld:
        status === "playing" &&
        !helpButtonPressed &&
        !practiceSettingsButtonPressed &&
        (this.keys.shoot.isDown ||
          pointer.leftButtonDown() ||
          pointerPressed ||
          (autoFireEnabled && this.hasPointerAim)),
      restartPressed:
        Phaser.Input.Keyboard.JustDown(this.keys.restart) || menuAction === "restart",
      pausePressed,
      quitToTitlePressed:
        Phaser.Input.Keyboard.JustDown(this.keys.quitToTitle) || menuAction === "title",
      upgradeChoicePressed: clickedUpgradeChoice ?? keyboardUpgradeChoice,
      contractChoicePressed,
      tutorialContinuePressed,
      specialPressed:
        this.exProtocolInputEnabled &&
        status === "playing" &&
        !pausePressed &&
        (specialPointerPressed || specialKeyboardPressed),
    };
  }

  consumeChoiceInputMethod(): ChoiceInteractionInputMethod | null {
    const inputMethod = this.pendingChoiceInputMethod;
    this.pendingChoiceInputMethod = null;
    return inputMethod;
  }

  readDebugTogglePressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.debug);
  }

  readAutoPilotTogglePressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.autoPilot);
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
    this.specialPointerPressed = false;
    this.keys.special?.reset();
    this.keys.help.reset();
    this.hasPointerAim = false;
    this.pendingMenuAction = null;
    this.pendingChoiceInputMethod = null;
  }

  destroy(): void {
    this.clearTransientInput();
    this.scene.input.off(
      Phaser.Input.Events.POINTER_MOVE,
      this.handlePointerMove,
    );
    this.scene.input.off(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
    );
    this.configureExProtocolInput(false);
  }

  syncCursor(
    status: GameStatus,
    upgradeChoiceCount: number,
    secondaryMenu: SecondaryMenu | null = null,
    practiceActive = false,
  ): void {
    const pointer = this.scene.input.activePointer;
    this.updateCursor(
      status,
      upgradeChoiceCount,
      pointer.x,
      pointer.y,
      secondaryMenu,
      practiceActive,
    );
  }

  private updateCursor(
    status: GameStatus,
    upgradeChoiceCount: number,
    pointerX: number,
    pointerY: number,
    secondaryMenu: SecondaryMenu | null,
    practiceActive: boolean,
  ): void {
    if (status === "playing" && secondaryMenu === null) {
      const overHelpButton = isPointInHelpBounds(
        getHelpHudButtonBounds(
          this.scene.scale.gameSize.width,
          this.scene.scale.gameSize.height,
        ),
        pointerX,
        pointerY,
      );
      const overPracticeSettings =
        practiceActive &&
        isPointInPracticeControl(
          getPracticeSettingsButtonBounds(
            this.scene.scale.gameSize.width,
          ),
          pointerX,
          pointerY,
        );
      this.setCursor(
        overHelpButton || overPracticeSettings ? "pointer" : "none",
      );
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
