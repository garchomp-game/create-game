import * as Phaser from "phaser";
import { TEXT } from "../../lang";
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
        TEXT.debug.title,
        TEXT.debug.delta(snapshot.dtMs.toFixed(1)),
        TEXT.debug.p95Delta(snapshot.p95DtMs.toFixed(1)),
        TEXT.debug.enemies(snapshot.enemies),
        TEXT.debug.bullets(snapshot.bullets),
      ].join("\n"),
    );
  }
}
