import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type {
  AutoPilotFrame,
  AutoPilotIntent,
  AutoPilotNavigationPort,
} from "./autoPilotContracts";
import { planAutoPilotMovement } from "./autoPilotMovement";
import { createWorld } from "./createWorld";

describe("planAutoPilotMovement", () => {
  it("uses partial speed when a full-horizon step is blocked", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const start = { ...world.player.position };
    const frame: AutoPilotFrame = {
      world,
      config: SIMULATION_CONFIG,
      previousMove: { x: 0, y: 0 },
      previousAimTargetId: null,
    };
    const goal = { x: start.x + 200, y: start.y };
    const intent: AutoPilotIntent = {
      mode: "xpCollect",
      posture: "opportunistic",
      targetId: "partial-speed-xp",
      goalPosition: goal,
      combatTarget: null,
      desiredDirection: { x: 1, y: 0 },
      nextWaypoint: goal,
      preferredRange: null,
      goalWeight: 2,
      preserveLineOfSight: false,
      utility: 1,
      pathEta: 1,
      progressDistance: 200,
      switchReason: "initial",
    };
    const navigation: AutoPilotNavigationPort = {
      hasClearPath(_frame, pathStart, end) {
        return end.x - pathStart.x <= 80;
      },
      navigateTo() {
        return { x: 1, y: 0 };
      },
      navigateFrom() {
        return { x: 1, y: 0 };
      },
      estimatePath(_frame, pathStart, target) {
        return {
          reachable: true,
          direct: true,
          distance: Math.hypot(target.x - pathStart.x, target.y - pathStart.y),
          waypoints: [{ ...pathStart }, { ...target }],
        };
      },
    };

    const movement = planAutoPilotMovement(frame, intent, navigation);
    const inputMagnitude = Math.hypot(movement.move.x, movement.move.y);

    expect(inputMagnitude).toBeGreaterThanOrEqual(0.25);
    expect(inputMagnitude).toBeLessThan(1);
    expect(movement.move.x).toBeGreaterThan(0);
    expect(movement.motionDisposition).toBe("safetyDeflection");
    expect(movement.movingSafeCandidateCount).toBeGreaterThan(0);
  });
});
