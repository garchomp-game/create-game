import type * as Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import { PRACTICE_GUIDE_TEXT_DEPTH } from "./PhaserArenaDepths";

export class PhaserPracticeGuideLayer {
  private readonly guide: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
  ) {
    this.guide = createGuideText(scene, 13, 0.38)
      .setOrigin(0, 0)
      .setAlign("left")
      .setLineSpacing(3)
      .setPosition(
        simulationConfig.arena.width - 268,
        simulationConfig.arena.height - 126,
      );
  }

  render(world: WorldState): void {
    const visible =
      Boolean(world.practice) &&
      world.state.status !== "title" &&
      world.state.status !== "weaponSelect" &&
      world.state.status !== "gameOver";
    this.guide.setVisible(visible);
    if (!visible || !world.practice) return;

    const invincible = world.practice.options.invincible ? "無敵 ON" : "無敵 OFF";
    this.guide.setText(
      [
        `PRACTICE  固定 / 記録なし / ${invincible}`,
        "移動  WASD / 矢印",
        "照準  MOUSE",
        "射撃  左クリック / SPACE",
        "停止  ESC",
      ].join("\n"),
    );
  }
}

function createGuideText(
  scene: Phaser.Scene,
  fontSize: number,
  alpha: number,
): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: `${fontSize}px`,
      color: "#a5f3fc",
      letterSpacing: 0,
      stroke: "#020617",
      strokeThickness: 3,
    })
    .setAlpha(alpha)
    .setDepth(PRACTICE_GUIDE_TEXT_DEPTH)
    .setVisible(false);
}
