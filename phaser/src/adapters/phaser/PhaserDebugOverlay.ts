import Phaser from "phaser";
import type { MetricsReader } from "../../ports/MetricsPort";

export class PhaserDebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene, private readonly metrics: MetricsReader) {
    this.text = scene.add
      .text(18, 438, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#cbd5e1",
        backgroundColor: "rgba(2, 6, 23, 0.68)",
        padding: { x: 8, y: 6 },
      })
      .setDepth(30)
      .setVisible(false);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
  }

  render(): void {
    if (!this.visible) return;

    const snapshot = this.metrics.getSnapshot();
    this.text.setText(
      [
        "Debug",
        `dt: ${snapshot.dtMs.toFixed(1)} ms`,
        `p95 dt: ${snapshot.p95DtMs.toFixed(1)} ms`,
        `enemies: ${snapshot.enemies}`,
        `bullets: ${snapshot.bullets}`,
      ].join("\n"),
    );
  }
}
