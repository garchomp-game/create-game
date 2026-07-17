import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { Pickup } from "../domain/types";
import type {
  AutoPilotNavigationPort,
  AutoPilotPickupSelectionDiagnostics,
} from "./autoPilotContracts";
import { createWorld } from "./createWorld";
import { ROT_AUTO_PILOT_NAVIGATION } from "./autoPilotNavigation";
import { selectPickupTarget } from "./autoPilotTargeting";

describe("selectPickupTarget", () => {
  it("uses the navigable path length and ETA around cover", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.player.position = { x: 180, y: 270 };
    world.obstacles = [{ id: "wall", x: 220, y: 150, width: 120, height: 240 }];
    world.pickups.push(createPickup("xp", { x: 380, y: 270 }));

    const target = selectPickupTarget(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "xp",
    );

    expect(target).not.toBeNull();
    expect(target!.path.direct).toBe(false);
    expect(target!.pathDistance).toBeGreaterThan(target!.distance);
    expect(target!.eta).toBeGreaterThan(0);
  });

  it("rejects a healing pickup that expires before path arrival", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.hp = 70;
    world.player.position = { x: 180, y: 270 };
    world.obstacles = [{ id: "wall", x: 220, y: 150, width: 120, height: 240 }];
    world.pickups.push(createPickup("heal", { x: 380, y: 270 }, 0.2));

    expect(
      selectPickupTarget(
        createFrame(world),
        ROT_AUTO_PILOT_NAVIGATION,
        "heal",
      ),
    ).toBeNull();
  });

  it("does not target healing at full HP without predicted path damage", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.pickups.push(createPickup("heal", { x: 520, y: 270 }, 12));

    expect(
      selectPickupTarget(
        createFrame(world),
        ROT_AUTO_PILOT_NAVIGATION,
        "heal",
      ),
    ).toBeNull();
  });

  it("keeps nearby effective healing valuable outside emergency health", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.state.hp = 88;
    world.pickups.push(
      createPickup("xp", { x: 590, y: 270 }),
      createPickup("heal", { x: 525, y: 270 }, 18),
    );
    const frame = createFrame(world);
    const heal = selectPickupTarget(frame, ROT_AUTO_PILOT_NAVIGATION, "heal");
    const xp = selectPickupTarget(frame, ROT_AUTO_PILOT_NAVIGATION, "xp");

    expect(heal).not.toBeNull();
    expect(xp).not.toBeNull();
    expect(heal!.effectiveValue).toBe(12);
    expect(heal!.utility).toBeGreaterThan(0.5);
    expect(xp!.utility).toBeGreaterThan(heal!.utility);
  });

  it("prefers a nearby experience cluster while draining a backlog", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.pickups.push(createPickup("xp", { x: 280, y: 270 }, null, "sparse"));
    for (let index = 0; index < 12; index += 1) {
      world.pickups.push(createPickup(
        "xp",
        { x: 690 + index % 4 * 5, y: 250 + index % 3 * 8 },
        null,
        `cluster-${index}`,
      ));
    }

    const target = selectPickupTarget(
      createFrame(world),
      ROT_AUTO_PILOT_NAVIGATION,
      "xp",
      {
        maximumDistance: 700,
        prioritizeDensity: true,
        candidateLimit: 24,
        fullPathCandidateLimit: 7,
      },
    );

    expect(target?.pickup.id).toMatch(/^cluster-/);
    expect(target?.corridorPickupCount).toBeGreaterThanOrEqual(8);
    expect(target?.corridorXpValue).toBeGreaterThanOrEqual(16);
  });

  it("continues into the next batch when nearer paths are unreachable", () => {
    const world = createWorld(SIMULATION_CONFIG);
    const player = world.player.position;
    world.pickups.push(
      createPickup("xp", { x: player.x + 40, y: player.y }, null, "blocked-1"),
      createPickup("xp", { x: player.x + 60, y: player.y }, null, "blocked-2"),
      createPickup("xp", { x: player.x + 80, y: player.y }, null, "blocked-3"),
      createPickup("xp", { x: player.x + 100, y: player.y }, null, "reachable-4"),
    );
    const blockedX = new Set([
      player.x + 40,
      player.x + 60,
      player.x + 80,
    ]);
    const navigation: AutoPilotNavigationPort = {
      ...ROT_AUTO_PILOT_NAVIGATION,
      estimatePath(frame, start, target, radius) {
        if (blockedX.has(target.x)) {
          return {
            reachable: false,
            direct: false,
            distance: Number.POSITIVE_INFINITY,
            waypoints: [{ ...start }],
          };
        }
        return ROT_AUTO_PILOT_NAVIGATION.estimatePath(
          frame,
          start,
          target,
          radius,
        );
      },
    };
    let diagnostics: AutoPilotPickupSelectionDiagnostics | null = null;

    const target = selectPickupTarget(
      createFrame(world),
      navigation,
      "xp",
      {
        safeOnly: true,
        candidateLimit: 7,
        fullPathCandidateLimit: 3,
        onDiagnostics(value) {
          diagnostics = value;
        },
      },
    );

    expect(target?.pickup.id).toBe("reachable-4");
    expect(diagnostics).toMatchObject({
      pickupSourceCount: 4,
      withinSearchDistanceCount: 4,
      prefilteredCount: 4,
      pathEvaluatedCount: 4,
      reachableCount: 1,
      ttlValidCount: 1,
      safeCount: 1,
      selectedPickupId: "reachable-4",
      rejectedByReason: { pathUnreachable: 3 },
    });
  });
});

function createFrame(world: ReturnType<typeof createWorld>) {
  return {
    world,
    config: SIMULATION_CONFIG,
    previousMove: { x: 0, y: 0 },
    previousAimTargetId: null,
  };
}

function createPickup(
  kind: Pickup["kind"],
  position: Pickup["position"],
  lifetime: number | null = kind === "heal" ? 18 : null,
  id = `${kind}-pickup`,
): Pickup {
  return {
    id,
    kind,
    position,
    radius: kind === "heal"
      ? SIMULATION_CONFIG.pickup.healRadius
      : SIMULATION_CONFIG.pickup.xpRadius,
    xpValue: kind === "xp" ? 2 : 0,
    healValue: kind === "heal" ? 12 : 0,
    lifetime,
  };
}
