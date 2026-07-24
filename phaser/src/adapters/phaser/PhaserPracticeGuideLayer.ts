import type * as Phaser from "phaser";
import type { SimulationConfig, WorldState } from "../../domain/types";
import { PRACTICE_GUIDE_TEXT_DEPTH } from "./PhaserArenaDepths";

export class PhaserPracticeGuideLayer {
  private readonly heading: Phaser.GameObjects.Text;
  private readonly movement: Phaser.GameObjects.Text;
  private readonly aiming: Phaser.GameObjects.Text;
  private readonly commands: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly simulationConfig: SimulationConfig,
  ) {
    const centerX = simulationConfig.arena.width / 2;
    this.heading = createGuideText(scene, 15, 0.28)
      .setOrigin(0.5, 0)
      .setPosition(centerX, 108);
    this.movement = createGuideText(scene, 24, 0.18)
      .setOrigin(0.5)
      .setAlign("center")
      .setPosition(146, simulationConfig.arena.height / 2);
    this.aiming = createGuideText(scene, 24, 0.18)
      .setOrigin(0.5)
      .setAlign("center")
      .setPosition(
        simulationConfig.arena.width - 146,
        simulationConfig.arena.height / 2,
      );
    this.commands = createGuideText(scene, 14, 0.24)
      .setOrigin(0.5, 1)
      .setPosition(centerX, simulationConfig.arena.height - 24);
  }

  render(world: WorldState): void {
    const visible =
      Boolean(world.practice) &&
      world.state.status !== "title" &&
      world.state.status !== "weaponSelect" &&
      world.state.status !== "gameOver";
    this.heading.setVisible(visible);
    this.movement.setVisible(visible);
    this.aiming.setVisible(visible);
    this.commands.setVisible(visible);
    if (!visible || !world.practice) return;

    const invincible = world.practice.options.invincible ? "無敵 ON" : "無敵 OFF";
    this.heading.setText(`PRACTICE  難易度固定  記録なし  ${invincible}`);
    this.movement.setText("W  A  S  D\n移動");
    this.aiming.setText("MOUSE\n照準");
    this.commands.setText("左クリック / SPACE  射撃    ESC  一時停止");
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
