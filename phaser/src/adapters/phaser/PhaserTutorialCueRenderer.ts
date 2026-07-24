import type * as Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import type { ArenaTutorialViewModel } from "../../presentation/ArenaTutorialPresenter";
import {
  getCurrentRouteDestination,
  getTutorialCueKeys,
  type TutorialMoveKey,
} from "../../presentation/TutorialCueLayout";
import {
  TUTORIAL_OVERLAY_GRAPHICS_DEPTH,
  TUTORIAL_OVERLAY_TEXT_DEPTH,
} from "./PhaserArenaDepths";

export class PhaserTutorialCueRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly cueLabelText: Phaser.GameObjects.Text;
  private readonly keyTexts: Record<TutorialMoveKey, Phaser.GameObjects.Text>;
  private readonly targetLabelText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
  ) {
    this.graphics = scene.add
      .graphics()
      .setDepth(TUTORIAL_OVERLAY_GRAPHICS_DEPTH);
    this.cueLabelText = createText(scene, 14, "#f8fafc")
      .setOrigin(0.5, 0.5)
      .setAlign("center");
    this.keyTexts = {
      W: createKeyText(scene),
      A: createKeyText(scene),
      S: createKeyText(scene),
      D: createKeyText(scene),
    };
    this.targetLabelText = createText(scene, 14, "#fef3c7")
      .setOrigin(0.5, 0.5)
      .setAlign("center");
  }

  render(
    world: WorldState,
    view: ArenaTutorialViewModel | null,
  ): void {
    this.graphics.clear();
    this.cueLabelText.setVisible(false);
    this.targetLabelText.setVisible(false);
    for (const text of Object.values(this.keyTexts)) text.setVisible(false);
    if (!view?.visible || view.presentation !== "hud") return;

    if (view.target) this.renderTarget(world, view);
    if (view.cueKind) this.renderInputCue(world, view);
  }

  private renderTarget(
    world: WorldState,
    view: ArenaTutorialViewModel,
  ): void {
    const target = view.target;
    if (!target) return;
    const pulse =
      view.cueLevel > 0
        ? (Math.sin(world.state.elapsed * 7) + 1) * 3
        : 0;
    const radius = target.radius + pulse;
    if (view.showGuideLine) {
      this.graphics.lineStyle(2, 0xfacc15, 0.72);
      this.graphics.beginPath();
      this.graphics.moveTo(world.player.position.x, world.player.position.y);
      for (const point of target.guidePath ?? []) {
        this.graphics.lineTo(point.x, point.y);
      }
      this.graphics.lineTo(target.position.x, target.position.y);
      this.graphics.strokePath();
    }
    this.graphics.fillStyle(0xfacc15, target.kind === "zone" ? 0.12 : 0.05);
    this.graphics.fillCircle(target.position.x, target.position.y, radius);
    this.graphics.lineStyle(view.cueLevel > 0 ? 4 : 3, 0xfacc15, 0.96);
    this.graphics.strokeCircle(target.position.x, target.position.y, radius);
    if (view.targetLabel) this.renderTargetLabel(target, view.targetLabel);
  }

  private renderInputCue(
    world: WorldState,
    view: ArenaTutorialViewModel,
  ): void {
    const cueKind = view.cueKind;
    if (!cueKind) return;
    const animatedPulse =
      0.72 + (Math.sin(world.state.elapsed * 8) + 1) * 0.12;
    const pulse = view.cueLevel > 0 ? animatedPulse : 0.76;
    const centerX = this.simulationConfig.arena.width / 2;
    const centerY = this.simulationConfig.arena.height - 158;

    this.graphics.fillStyle(0x020617, 0.9);
    this.graphics.lineStyle(2, 0x67e8f9, pulse);

    if (cueKind === "aim") {
      this.renderAimCue(centerX, centerY, pulse, view);
      return;
    }
    if (cueKind === "observe") {
      this.renderObserveCue(centerX, centerY, pulse, view);
      return;
    }
    if (cueKind === "upgrade") return;

    const highlightedKeys = getTutorialCueKeys(
      cueKind,
      world.player.position,
      view.target,
    );
    this.renderMovementPanel(
      centerX,
      centerY,
      highlightedKeys.size,
      pulse,
      view,
    );
    this.renderMovementKeys(
      centerX,
      centerY,
      highlightedKeys,
      pulse,
      view.cueLevel,
    );
    this.renderCueLabel(centerX, centerY + 31, view.cueLabel);

    if ((cueKind === "route" || cueKind === "move") && view.target) {
      this.renderDirectionArrow(world, view.target, pulse);
    }
  }

  private renderAimCue(
    centerX: number,
    centerY: number,
    pulse: number,
    view: ArenaTutorialViewModel,
  ): void {
    this.graphics.fillRoundedRect(centerX - 42, centerY - 20, 28, 40, 12);
    this.graphics.strokeRoundedRect(centerX - 42, centerY - 20, 28, 40, 12);
    this.graphics.lineBetween(
      centerX - 28,
      centerY - 19,
      centerX - 28,
      centerY - 7,
    );
    this.graphics.lineStyle(
      view.cueLevel > 0 ? 3 : 2,
      0xfacc15,
      pulse,
    );
    this.graphics.strokeCircle(centerX + 22, centerY, 13);
    this.graphics.lineBetween(
      centerX + 22,
      centerY - 20,
      centerX + 22,
      centerY - 8,
    );
    this.graphics.lineBetween(
      centerX + 22,
      centerY + 8,
      centerX + 22,
      centerY + 20,
    );
    this.graphics.lineBetween(
      centerX + 2,
      centerY,
      centerX + 14,
      centerY,
    );
    this.graphics.lineBetween(
      centerX + 30,
      centerY,
      centerX + 42,
      centerY,
    );
    this.renderCueLabel(centerX, centerY + 34, view.cueLabel);
  }

  private renderObserveCue(
    centerX: number,
    centerY: number,
    pulse: number,
    view: ArenaTutorialViewModel,
  ): void {
    const width = 154;
    const height = 38;
    this.graphics.fillStyle(0x422006, 0.96);
    this.graphics.lineStyle(
      view.cueLevel > 0 ? 3 : 2,
      0xfacc15,
      pulse,
    );
    this.graphics.fillRoundedRect(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height,
      5,
    );
    this.graphics.strokeRoundedRect(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height,
      5,
    );
    this.renderCueLabel(centerX, centerY, view.cueLabel);
  }

  private renderMovementPanel(
    centerX: number,
    centerY: number,
    keyCount: number,
    pulse: number,
    view: ArenaTutorialViewModel,
  ): void {
    const width = Math.max(116, keyCount * 48 + 28);
    const height = 88;
    this.graphics.fillStyle(0x020617, 0.9);
    this.graphics.lineStyle(
      view.cueLevel > 0 ? 3 : 2,
      view.cueLevel > 0 ? 0xfacc15 : 0x22d3ee,
      pulse,
    );
    this.graphics.fillRoundedRect(
      centerX - width / 2,
      centerY - 45,
      width,
      height,
      7,
    );
    this.graphics.strokeRoundedRect(
      centerX - width / 2,
      centerY - 45,
      width,
      height,
      7,
    );
  }

  private renderMovementKeys(
    centerX: number,
    centerY: number,
    highlightedKeys: ReadonlySet<TutorialMoveKey>,
    pulse: number,
    cueLevel: 0 | 1 | 2,
  ): void {
    const keyWidth = 42;
    const keyHeight = 42;
    const gap = 6;
    const keyDefinitions: Record<TutorialMoveKey, string> = {
      W: "↑",
      A: "←",
      S: "↓",
      D: "→",
    };
    const orderedKeys: TutorialMoveKey[] = ["W", "A", "S", "D"];
    const visibleKeys = orderedKeys.filter((key) => highlightedKeys.has(key));
    const keys = visibleKeys.length > 0 ? visibleKeys : orderedKeys;
    const totalWidth = keys.length * keyWidth + (keys.length - 1) * gap;
    const startX = centerX - totalWidth / 2;

    keys.forEach((keyId, index) => {
      const highlighted = highlightedKeys.has(keyId);
      const x = startX + index * (keyWidth + gap);
      const y = centerY - 28;
      this.graphics.fillStyle(highlighted ? 0x164e63 : 0x0f172a, 0.96);
      this.graphics.lineStyle(
        highlighted && cueLevel > 0 ? 3 : 2,
        highlighted ? 0xfacc15 : 0x64748b,
        highlighted ? pulse : 0.82,
      );
      this.graphics.fillRoundedRect(
        x,
        y,
        keyWidth,
        keyHeight,
        4,
      );
      this.graphics.strokeRoundedRect(
        x,
        y,
        keyWidth,
        keyHeight,
        4,
      );
      this.keyTexts[keyId]
        .setPosition(x + keyWidth / 2, y + keyHeight / 2)
        .setText(`${keyId} ${keyDefinitions[keyId]}`)
        .setColor(highlighted ? "#ffffff" : "#94a3b8")
        .setVisible(true);
    });
  }

  private renderDirectionArrow(
    world: WorldState,
    target: NonNullable<ArenaTutorialViewModel["target"]>,
    alpha: number,
  ): void {
    const destination = getCurrentRouteDestination(
      world.player.position,
      target,
    );
    const xDifference = destination.x - world.player.position.x;
    const yDifference = destination.y - world.player.position.y;
    const length = Math.hypot(xDifference, yDifference);
    if (length < 1) return;
    const direction = {
      x: xDifference / length,
      y: yDifference / length,
    };
    const start = {
      x: world.player.position.x + direction.x * 30,
      y: world.player.position.y + direction.y * 30,
    };
    const end = {
      x: world.player.position.x + direction.x * 58,
      y: world.player.position.y + direction.y * 58,
    };
    const perpendicular = { x: -direction.y, y: direction.x };

    this.graphics.lineStyle(4, 0xfacc15, alpha);
    this.graphics.lineBetween(start.x, start.y, end.x, end.y);
    this.graphics.fillStyle(0xfacc15, alpha);
    this.graphics.fillTriangle(
      end.x + direction.x * 8,
      end.y + direction.y * 8,
      end.x - direction.x * 6 + perpendicular.x * 7,
      end.y - direction.y * 6 + perpendicular.y * 7,
      end.x - direction.x * 6 - perpendicular.x * 7,
      end.y - direction.y * 6 - perpendicular.y * 7,
    );
  }

  private renderCueLabel(
    x: number,
    y: number,
    label: string | null,
  ): void {
    if (!label) return;
    this.cueLabelText
      .setPosition(x, y)
      .setText(label)
      .setVisible(true);
  }

  private renderTargetLabel(
    target: NonNullable<ArenaTutorialViewModel["target"]>,
    label: string,
  ): void {
    const x = clamp(
      target.position.x,
      72,
      this.simulationConfig.arena.width - 72,
    );
    const preferredAbove = target.position.y - target.radius - 24;
    const preferredY =
      preferredAbove < 104
        ? target.position.y + target.radius + 24
        : preferredAbove;
    const y = clamp(preferredY, 104, 418);
    this.targetLabelText
      .setPosition(x, y)
      .setText(label)
      .setVisible(true);
    const width = this.targetLabelText.width + 18;
    this.graphics.fillStyle(0x020617, 0.92);
    this.graphics.fillRoundedRect(x - width / 2, y - 12, width, 24, 4);
    this.graphics.lineStyle(1, 0xfacc15, 0.92);
    this.graphics.strokeRoundedRect(x - width / 2, y - 12, width, 24, 4);
  }
}

function createText(
  scene: Phaser.Scene,
  fontSize: number,
  color: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: `${fontSize}px`,
      color,
      letterSpacing: 0,
    })
    .setDepth(TUTORIAL_OVERLAY_TEXT_DEPTH)
    .setVisible(false);
}

function createKeyText(scene: Phaser.Scene): Phaser.GameObjects.Text {
  return createText(scene, 15, "#f8fafc")
    .setOrigin(0.5, 0.5)
    .setAlign("center");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
