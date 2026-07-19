import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { InputSnapshot } from "../domain/types";
import { createWorld } from "../simulation/createWorld";
import { AutoPilotController } from "./AutoPilotController";

const manualInput: InputSnapshot = {
  move: { x: 1, y: 0 },
  aimWorld: null,
  startPressed: false,
  shootHeld: false,
  restartPressed: true,
  pausePressed: true,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
};

describe("AutoPilotController", () => {
  it("owns enablement and preserves manual control commands", () => {
    const controller = new AutoPilotController("periodic-v3");
    const world = createWorld(SIMULATION_CONFIG);
    world.state.status = "upgradeSelect";
    world.progression.pendingUpgradeChoices = ["rapidFire"];

    controller.start();
    const resolved = controller.resolveInput(
      manualInput,
      world,
      SIMULATION_CONFIG,
    );

    expect(resolved.restartPressed).toBe(true);
    expect(resolved.pausePressed).toBe(true);
    expect(resolved.upgradeChoicePressed).toBe(0);
    expect(controller.getSnapshot()).toMatchObject({
      enabled: true,
      mode: "upgrade",
      intentMode: "upgrade",
    });
  });

  it("returns manual input unchanged while disabled and disables on title reset", () => {
    const controller = new AutoPilotController("visit-history-v1");
    const world = createWorld(SIMULATION_CONFIG);

    expect(controller.resolveInput(manualInput, world, SIMULATION_CONFIG)).toBe(
      manualInput,
    );
    controller.start();
    controller.resetForRun("title");

    expect(controller.getSnapshot()).toEqual({
      enabled: false,
      mode: null,
      intentMode: null,
      overrideReason: null,
      riskScore: 0,
      targetId: null,
    });
  });
});
