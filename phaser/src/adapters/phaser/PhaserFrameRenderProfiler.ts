import * as Phaser from "phaser";
import {
  DurationHistogram,
  type DurationHistogramSnapshot,
} from "../../application/DurationHistogram";

type Clock = () => number;

export class PhaserFrameRenderProfiler {
  private readonly durations = new DurationHistogram(100, 0.25);
  private renderStartedAt: number | null = null;
  private readonly handlePreRender = (): void => {
    this.renderStartedAt = this.clock();
  };
  private readonly handlePostRender = (): void => {
    if (this.renderStartedAt === null) return;
    this.durations.record(this.clock() - this.renderStartedAt);
    this.renderStartedAt = null;
  };

  constructor(
    private readonly events: Phaser.Events.EventEmitter,
    private readonly enabled: boolean,
    private readonly clock: Clock = now,
  ) {
    if (!enabled) return;
    events.on(Phaser.Core.Events.PRE_RENDER, this.handlePreRender);
    events.on(Phaser.Core.Events.POST_RENDER, this.handlePostRender);
  }

  reset(): void {
    this.renderStartedAt = null;
    this.durations.reset();
  }

  destroy(): void {
    if (!this.enabled) return;
    this.events.off(Phaser.Core.Events.PRE_RENDER, this.handlePreRender);
    this.events.off(Phaser.Core.Events.POST_RENDER, this.handlePostRender);
  }

  getSnapshot(): DurationHistogramSnapshot {
    return this.durations.getSnapshot();
  }
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
