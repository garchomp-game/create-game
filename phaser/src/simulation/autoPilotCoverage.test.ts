import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Pickup, WorldState } from "../domain/types";
import type { AutoPilotFrame } from "./autoPilotContracts";
import {
  createAutoPilotCoverageTracker,
  createAutoPilotCoverageZones,
} from "./autoPilotCoverage";
import { ROT_AUTO_PILOT_NAVIGATION } from "./autoPilotNavigation";
import { createWorld } from "./createWorld";

describe("autoPilotCoverage", () => {
  it("creates nine deterministic reachable zones inside the safe arena", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const first = createAutoPilotCoverageZones(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
    );
    const second = createAutoPilotCoverageZones(
      createFrame(createWorld(SIMULATION_CONFIG)),
      ROT_AUTO_PILOT_NAVIGATION,
    );

    expect(first).toEqual(second);
    expect(first).toHaveLength(9);
    expect(new Set(first.map((zone) => zone.id)).size).toBe(9);
    expect(first.every((zone) => zone.pathDistance >= 0)).toBe(true);
    expect(first.every((zone) => zone.escapeClearance > 0)).toBe(true);
  });

  it("uses a deterministic alternate point when a zone center is blocked", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const baseline = createAutoPilotCoverageZones(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
    ).find((zone) => zone.id === "north-west");
    expect(baseline).toBeDefined();
    world.obstacles.push({
      id: "north-west-center",
      x: baseline!.position.x - 22,
      y: baseline!.position.y - 22,
      width: 44,
      height: 44,
    });

    const zones = createAutoPilotCoverageZones(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
    );
    const northWest = zones.find((zone) => zone.id === "north-west");

    expect(northWest).toBeDefined();
    expect(northWest!.position).not.toEqual(baseline!.position);
    expect(
      northWest!.position.x >= baseline!.position.x - 22 &&
        northWest!.position.x <= baseline!.position.x + 22 &&
        northWest!.position.y >= baseline!.position.y - 22 &&
        northWest!.position.y <= baseline!.position.y + 22,
    ).toBe(false);
  });

  it("assigns edge experience to the nearest safe coverage region", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.pickups.push(createXpPickup("edge-xp", { x: 4, y: 4 }));

    const zones = createAutoPilotCoverageZones(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
    );

    expect(zones.find((zone) => zone.id === "north-west")?.xpPickupCount).toBe(1);
    expect(
      zones
        .filter((zone) => zone.id !== "north-west")
        .every((zone) => zone.xpPickupCount === 0),
    ).toBe(true);
  });

  it("rebuilds zone positions inside the current collapse inset", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.encounter.collapse.inset = 120;

    const zones = createAutoPilotCoverageZones(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
    );

    expect(zones.length).toBeGreaterThan(0);
    expect(zones.length).toBeLessThanOrEqual(9);
    expect(zones.every((zone) => zone.position.x > 120)).toBe(true);
    expect(zones.every((zone) => zone.position.x < SIMULATION_CONFIG.arena.width - 120)).toBe(
      true,
    );
    expect(zones.every((zone) => zone.position.y > 120)).toBe(true);
    expect(zones.every((zone) => zone.position.y < SIMULATION_CONFIG.arena.height - 120)).toBe(
      true,
    );
  });

  it("pauses the coverage clock during warning and active phases", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const tracker = createAutoPilotCoverageTracker();

    tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "periodic-v3",
      null,
    );
    world.state.elapsed = 1;
    let snapshot = tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "periodic-v3",
      "patrol",
    );
    expect(snapshot.clock).toBeCloseTo(1);

    world.encounter.director.phase = "warning";
    world.state.elapsed = 2;
    snapshot = tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "periodic-v3",
      "xpCollect",
    );
    const warningStartedClock = snapshot.clock;
    world.state.elapsed = 7;
    snapshot = tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "periodic-v3",
      "xpCollect",
    );
    expect(snapshot.clock).toBeCloseTo(warningStartedClock);

    world.encounter.director.phase = "active";
    world.state.elapsed = 12;
    snapshot = tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "periodic-v3",
      "engage",
    );
    expect(snapshot.clock).toBeCloseTo(warningStartedClock);
  });

  it("selects, reaches, and resets a visit-history target", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const tracker = createAutoPilotCoverageTracker();
    let snapshot = tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "visit-history-v1",
      null,
    );

    expect(snapshot.transitionReason).toBe("selected");
    expect(snapshot.targetZoneId).not.toBeNull();
    expect(snapshot.targetPosition).not.toBeNull();

    world.player.position = { ...snapshot.targetPosition! };
    world.state.elapsed = 0.1;
    snapshot = tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "visit-history-v1",
      "patrol",
    );
    expect(snapshot.transitionReason).toBe("reached");
    expect(snapshot.targetZoneId).toBeNull();

    tracker.reset();
    snapshot = tracker.update(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "visit-history-v1",
      null,
    );
    expect(snapshot.clock).toBe(0);
    expect(snapshot.transitionReason).toBe("selected");
  });

  it("keeps coverage coefficients independent from weapon and profile", () => {
    const pulse = createWorld(SIMULATION_CONFIG);
    const spread = createWorld(SIMULATION_CONFIG);
    spread.state.weaponType = "spread";
    const pulseZones = createAutoPilotCoverageZones(
      createFrame(pulse, "fair"),
      ROT_AUTO_PILOT_NAVIGATION,
    );
    const spreadZones = createAutoPilotCoverageZones(
      createFrame(spread, "ceiling"),
      ROT_AUTO_PILOT_NAVIGATION,
    );

    expect(spreadZones).toEqual(pulseZones);
  });
});

function createFrame(
  world: WorldState,
  profile: AutoPilotFrame["profile"] = "ceiling",
): AutoPilotFrame {
  return {
    world,
    config: SIMULATION_CONFIG,
    previousMove: { x: 0, y: 0 },
    previousAimTargetId: null,
    profile,
    patrolStrategy: "periodic-v3",
    coverage: null,
  };
}

function createXpPickup(id: string, position: Pickup["position"]): Pickup {
  return {
    id,
    kind: "xp",
    position,
    radius: SIMULATION_CONFIG.pickup.xpRadius,
    xpValue: 1,
    healValue: 0,
    lifetime: null,
  };
}
