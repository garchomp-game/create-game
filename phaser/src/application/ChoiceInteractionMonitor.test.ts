import { describe, expect, it } from "vitest";
import { createWorld } from "../simulation/createWorld";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import {
  ChoiceInteractionMonitor,
  createChoiceInteractionSurface,
  type MonotonicClockPort,
} from "./ChoiceInteractionMonitor";

class FakeClock implements MonotonicClockPort {
  value = 0;

  nowMs(): number {
    return this.value;
  }
}

describe("ChoiceInteractionMonitor", () => {
  it("keeps wall-clock choice duration separate from simulation time", () => {
    const clock = new FakeClock();
    const monitor = new ChoiceInteractionMonitor(clock);
    monitor.syncSurface(upgradeSurface(), 24);
    clock.value = 2_400;

    expect(monitor.select(1, "keyboard", 24, counters())).toBe(true);
    const report = monitor.getReport(60);

    expect(report.samples[0]).toMatchObject({
      phase: "upgrade",
      selectedId: "swiftStep",
      selectedIndex: 1,
      inputMethod: "keyboard",
      openedAtSimulationSeconds: 24,
      selectedAtSimulationSeconds: 24,
      visibleDurationMs: 2_400,
    });
    expect(report.summary).toMatchObject({
      totalVisibleDurationMs: 2_400,
      averageVisibleDurationMs: 2_400,
      choicesPerSimulationMinute: 1,
    });
    expect(report.summary.stoppedWallClockRatio).toBeCloseTo(2_400 / 62_400);
  });

  it("records input and actual recovery during the first simulation second", () => {
    const clock = new FakeClock();
    const monitor = new ChoiceInteractionMonitor(clock);
    monitor.syncSurface(upgradeSurface(), 10);
    clock.value = 500;
    monitor.select(0, "pointer", 10, counters(100, 20, 8));

    monitor.observeResume({
      simulationSeconds: 10,
      moveInput: true,
      aimInput: true,
      shootInput: true,
      ...counters(100, 20, 8),
    });
    monitor.observeResume({
      simulationSeconds: 10.5,
      moveInput: true,
      aimInput: true,
      shootInput: true,
      ...counters(112, 22, 8),
    });
    monitor.observeResume({
      simulationSeconds: 11,
      moveInput: false,
      aimInput: true,
      shootInput: true,
      ...counters(118, 24, 11),
    });

    expect(monitor.getReport(11).samples[0]?.resumeWindow).toEqual({
      completed: true,
      observedSimulationSeconds: 1,
      movementInputFrames: 1,
      aimInputFrames: 2,
      shootInputFrames: 2,
      movementDistance: 18,
      shotsFired: 4,
      damageTaken: 3,
    });
  });

  it("identifies a completed hard stall without treating an incomplete window as one", () => {
    const clock = new FakeClock();
    const monitor = new ChoiceInteractionMonitor(clock);
    monitor.syncSurface(upgradeSurface(), 10);
    monitor.select(0, "keyboard", 10, counters());
    monitor.observeResume({
      simulationSeconds: 11,
      moveInput: false,
      aimInput: false,
      shootInput: false,
      ...counters(),
    });
    monitor.syncSurface(extraSurface(), 20);
    monitor.select(0, "pointer", 20, counters());

    const report = monitor.getReport(20);
    expect(report.summary.completedResumeWindowCount).toBe(1);
    expect(report.summary.hardStallCount).toBe(1);
    expect(report.samples[1]?.resumeWindow.completed).toBe(false);
  });

  it("keeps every resume window when choices are chained before simulation resumes", () => {
    const clock = new FakeClock();
    const monitor = new ChoiceInteractionMonitor(clock);
    monitor.syncSurface(upgradeSurface(), 10);
    monitor.select(0, "keyboard", 10, counters(100, 20, 4));
    monitor.syncSurface(extraSurface(), 10);
    monitor.select(0, "pointer", 10, counters(100, 20, 4));

    monitor.observeResume({
      simulationSeconds: 10.5,
      moveInput: true,
      aimInput: true,
      shootInput: true,
      ...counters(108, 22, 4),
    });
    monitor.observeResume({
      simulationSeconds: 11,
      moveInput: true,
      aimInput: true,
      shootInput: true,
      ...counters(116, 24, 7),
    });

    const report = monitor.getReport(11);
    expect(report.summary.completedResumeWindowCount).toBe(2);
    expect(report.samples.map((sample) => sample.resumeWindow)).toEqual([
      {
        completed: true,
        observedSimulationSeconds: 1,
        movementInputFrames: 2,
        aimInputFrames: 2,
        shootInputFrames: 2,
        movementDistance: 16,
        shotsFired: 4,
        damageTaken: 3,
      },
      {
        completed: true,
        observedSimulationSeconds: 1,
        movementInputFrames: 2,
        aimInputFrames: 2,
        shootInputFrames: 2,
        movementDistance: 16,
        shotsFired: 4,
        damageTaken: 3,
      },
    ]);
  });

  it("separates normal, extra, and contract phases and both input methods", () => {
    const clock = new FakeClock();
    const monitor = new ChoiceInteractionMonitor(clock);
    monitor.syncSurface(upgradeSurface(), 10);
    monitor.select(0, "keyboard", 10, counters());
    monitor.syncSurface(extraSurface(), 22);
    monitor.select(0, "pointer", 22, counters());
    monitor.syncSurface(contractSurface(), 40);
    monitor.select(1, "keyboard", 40, counters());

    const report = monitor.getReport(60);
    expect(report.summary.phaseCounts).toEqual({ upgrade: 1, extra: 1, contract: 1 });
    expect(report.summary.inputMethodCounts).toEqual({ keyboard: 2, pointer: 1 });
    expect(report.samples.map((sample) => sample.intervalSincePreviousChoiceSeconds)).toEqual([
      null,
      12,
      18,
    ]);
  });

  it("drops active state on reset and reports interruptions and invalid selections", () => {
    const clock = new FakeClock();
    const monitor = new ChoiceInteractionMonitor(clock);
    monitor.syncSurface(upgradeSurface(), 10);
    monitor.syncSurface(null, 10);
    expect(monitor.select(9, "keyboard", 10, counters())).toBe(false);
    expect(monitor.getReport(10)).toMatchObject({
      interruptedChoiceCount: 1,
      invalidSelectionCount: 1,
    });

    monitor.reset(true);
    expect(monitor.getReport(0)).toMatchObject({
      autoPilotObserved: true,
      interruptedChoiceCount: 0,
      invalidSelectionCount: 0,
      samples: [],
    });
  });

  it("clamps a regressing clock and never emits a negative duration", () => {
    const clock = new FakeClock();
    const monitor = new ChoiceInteractionMonitor(clock);
    clock.value = 500;
    monitor.syncSurface(upgradeSurface(), 10);
    clock.value = 400;
    monitor.select(0, "pointer", 10, counters());

    expect(monitor.getReport(10)).toMatchObject({
      clockRegressionCount: 1,
      samples: [{ visibleDurationMs: 0 }],
    });
  });

  it("derives stable surfaces from world state without mutating it", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "upgradeSelect";
    world.progression.pendingUpgradeChoices = ["rapidFire", "swiftStep"];
    const before = structuredClone(world);

    expect(createChoiceInteractionSurface(world)).toEqual({
      signature: "upgrade:1:0:0:rapidFire,swiftStep",
      phase: "upgrade",
      candidateIds: ["rapidFire", "swiftStep"],
    });
    expect(world).toEqual(before);
    world.progression.buildCompletedAt = 42;
    world.progression.extraLevel = 2;
    world.progression.extraCycle = 1;
    world.progression.pendingUpgradeChoices = ["limitPower", "limitCore"];
    expect(createChoiceInteractionSurface(world)).toEqual({
      signature: "extra:1:2:1:limitPower,limitCore",
      phase: "extra",
      candidateIds: ["limitPower", "limitCore"],
    });
  });
});

function upgradeSurface() {
  return {
    signature: "upgrade:1:rapidFire,swiftStep",
    phase: "upgrade" as const,
    candidateIds: ["rapidFire", "swiftStep"],
  };
}

function extraSurface() {
  return {
    signature: "extra:1:limitPower",
    phase: "extra" as const,
    candidateIds: ["limitPower"],
  };
}

function contractSurface() {
  return {
    signature: "contract:90",
    phase: "contract" as const,
    candidateIds: ["standard", "overdrive"],
  };
}

function counters(
  movementDistance = 0,
  shotsFired = 0,
  damageTaken = 0,
) {
  return { movementDistance, shotsFired, damageTaken };
}
