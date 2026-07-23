import { describe, expect, it } from "vitest";
import { ArenaSession } from "../application/ArenaSession";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameEvent, InputSnapshot, WorldState } from "../domain/types";
import { updateEncounter } from "./systems/encounterSystem";
import {
  completeBuild,
  updateLevelProgression,
} from "./systems/levelSystem";
import { chooseUpgrade } from "./systems/upgradeSystem";
import {
  chooseExProtocol,
  chooseExProtocolEvolution,
} from "./exProtocolProgression";

const idleInput: InputSnapshot = {
  move: { x: 0, y: 0 },
  aimWorld: null,
  startPressed: false,
  shootHeld: false,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
};

describe("EX Protocol progression", () => {
  it("lets pause win over a same-frame special press", () => {
    const session = createCandidateSession("pulse");
    completeNormalBuild(session.world, session.config);
    completeBuild(session.world, session.config, []);
    chooseExProtocol(session.world, 1, session.config, []);

    const result = session.step(
      {
        ...idleInput,
        pausePressed: true,
        specialPressed: true,
      },
      1 / 60,
    );

    expect(session.world.state.status).toBe("paused");
    expect(result.events.some((event) => event.type === "ex.special.armed")).toBe(
      false,
    );
    expect(session.world.progression.exProtocol).toMatchObject({
      status: "selected",
      runtime: {
        kind: "rebound-overdrive",
        armedUntil: null,
        cooldownUntil: 0,
      },
    });
  });

  it("routes Core 25 through Signature, E1, E2 + Mastery, then Limit Break", () => {
    const session = createCandidateSession("pulse");
    const { world, config } = session;
    completeNormalBuild(world, config);
    const buildEvents: GameEvent[] = [];

    completeBuild(world, config, buildEvents);

    expect(world.progression.buildCompletedAt).toBe(120);
    expect(world.progression.extraLevel).toBe(0);
    expect(world.state.status).toBe("protocolSelect");
    expect(world.progression.pendingChoice).toMatchObject({
      kind: "protocol",
      choices: expect.arrayContaining([
        "pulse.resonance-relay",
        "pulse.rebound-overdrive",
        "pulse.redline-core",
      ]),
    });
    expect(buildEvents.map((event) => event.type)).toEqual([
      "build.completed",
      "ex.protocol.offered",
    ]);

    const signatureEvents: GameEvent[] = [];
    expect(chooseExProtocol(world, 0, config, signatureEvents)).toBe(true);
    expect(world.state.status).toBe("playing");
    expect(world.progression.exProtocol).toMatchObject({
      status: "selected",
      route: {
        protocolId: "pulse.resonance-relay",
        evolutionOneId: null,
        evolutionTwoId: null,
        masteryUnlocked: false,
      },
      runtime: { kind: "resonance-relay" },
    });
    expect(world.progression.extraLevel).toBe(0);

    const excessXp = 17;
    world.progression.xp = world.progression.xpToNext + excessXp;
    const evolutionOneEvents: GameEvent[] = [];
    updateLevelProgression(
      world,
      session.randomStreams.upgrade,
      config,
      evolutionOneEvents,
    );
    expect(world.progression.extraLevel).toBe(1);
    expect(world.progression.xp).toBe(excessXp);
    expect(world.state.status).toBe("evolutionSelect");
    expect(world.progression.pendingChoice).toMatchObject({
      kind: "evolution-one",
      choices: ["extended-coupling", "dense-conduit"],
    });
    expect(
      chooseExProtocolEvolution(world, 0, config, evolutionOneEvents),
    ).toBe(true);

    world.progression.xp = world.progression.xpToNext;
    const evolutionTwoEvents: GameEvent[] = [];
    updateLevelProgression(
      world,
      session.randomStreams.upgrade,
      config,
      evolutionTwoEvents,
    );
    expect(world.progression.extraLevel).toBe(2);
    expect(world.progression.pendingChoice).toMatchObject({
      kind: "evolution-two",
      choices: ["residual-anchor", "endpoint-priming"],
    });
    expect(
      chooseExProtocolEvolution(world, 1, config, evolutionTwoEvents),
    ).toBe(true);
    expect(world.progression.exProtocol).toMatchObject({
      route: {
        evolutionOneId: "extended-coupling",
        evolutionTwoId: "endpoint-priming",
        masteryUnlocked: true,
      },
    });
    expect(evolutionTwoEvents).toContainEqual(
      expect.objectContaining({
        type: "ex.mastery.unlocked",
        masteryId: "crosslink",
      }),
    );

    world.progression.xp = world.progression.xpToNext;
    const limitBreakEvents: GameEvent[] = [];
    updateLevelProgression(
      world,
      session.randomStreams.upgrade,
      config,
      limitBreakEvents,
    );
    expect(world.progression.extraLevel).toBe(3);
    expect(world.progression.extraCycle).toBe(1);
    expect(world.progression.pendingChoice).toMatchObject({
      kind: "limit-break",
      choices: expect.arrayContaining(["limitPower"]),
    });
    expect(limitBreakEvents).toContainEqual(
      expect.objectContaining({
        type: "ex.limit_break.connected",
        exLevel: 3,
      }),
    );
    chooseUpgrade(world, 0, config, []);
    expect(world.state.status).toBe("playing");
  });

  it("does not consume the reserved RNG stream for fixed offers", () => {
    const candidate = createCandidateSession("spread");
    const untouched = createCandidateSession("spread");
    completeNormalBuild(candidate.world, candidate.config);
    completeNormalBuild(untouched.world, untouched.config);
    expect(candidate.randomStreams.exProtocol()).toBe(
      untouched.randomStreams.exProtocol(),
    );

    completeBuild(candidate.world, candidate.config, []);
    chooseExProtocol(candidate.world, 2, candidate.config, []);
    candidate.world.progression.xp =
      candidate.world.progression.xpToNext;
    updateLevelProgression(
      candidate.world,
      candidate.randomStreams.upgrade,
      candidate.config,
      [],
    );

    expect(candidate.randomStreams.exProtocol()).toBe(
      untouched.randomStreams.exProtocol(),
    );
  });

  it("keeps the EX choice flow and never offers the retired 240s contract", () => {
    const session = createCandidateSession("pulse");
    const { world, config } = session;
    completeNormalBuild(world, config);
    world.state.elapsed = 240;
    world.encounter.director.completedCount = 1;
    completeBuild(world, config, []);

    updateEncounter(
      world,
      session.randomStreams.encounter,
      config,
      [],
    );
    expect(world.state.status).toBe("protocolSelect");
    expect(world.encounter.contract.status).toBe("pending");

    chooseExProtocol(world, 0, config, []);
    world.state.elapsed = 300;
    updateEncounter(
      world,
      session.randomStreams.encounter,
      config,
      [],
    );
    expect(world.state.status).toBe("playing");
    expect(world.encounter.contract.status).toBe("pending");
  });

  it("lets Core completion win at the former contract threshold", () => {
    const session = createCandidateSession("pulse");
    const { world, config } = session;
    completeNormalBuild(world, config);
    world.progression.xp = world.progression.xpToNext;
    world.state.elapsed = 239.99;
    world.encounter.director.completedCount = 1;

    session.step(idleInput, 0.05);

    expect(world.state.status).toBe("protocolSelect");
    expect(world.progression.pendingChoice?.kind).toBe("protocol");
    expect(world.encounter.contract.status).toBe("pending");
  });

  it("skips unsupported debug weapons without a soft lock", () => {
    const session = createCandidateSession("pierce");
    const { world, config } = session;
    completeNormalBuild(world, config);
    const events: GameEvent[] = [];

    completeBuild(world, config, events);

    expect(world.progression.exProtocol).toEqual({
      status: "unsupported",
      route: null,
      runtime: null,
    });
    expect(world.state.status).toBe("playing");
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ex.protocol.skipped",
        weaponId: "pierce",
      }),
    );
    world.progression.xp = world.progression.xpToNext;
    updateLevelProgression(
      world,
      session.randomStreams.upgrade,
      config,
      [],
    );
    expect(world.progression.extraLevel).toBe(1);
    expect(world.progression.pendingChoice?.kind).toBe("limit-break");
  });
});

function createCandidateSession(
  weaponType: "pulse" | "spread" | "pierce",
): ArenaSession & {
  randomStreams: Extract<
    ArenaSession["randomStreams"],
    { version: "arena-rng-v2" }
  >;
} {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260723,
    weaponType,
    rulesetProfileId: "candidate-ex-endless-c2",
  });
  if (session.randomStreams.version !== "arena-rng-v2") {
    throw new Error("Candidate session did not resolve RNG v2.");
  }
  return session as ArenaSession & {
    randomStreams: Extract<
      ArenaSession["randomStreams"],
      { version: "arena-rng-v2" }
    >;
  };
}

function completeNormalBuild(
  world: WorldState,
  config: typeof SIMULATION_CONFIG,
): void {
  for (const upgradeId of Object.keys(world.progression.upgradeRanks) as Array<
    keyof typeof world.progression.upgradeRanks
  >) {
    if (
      config.upgrades[upgradeId].requirements?.weaponIds &&
      !config.upgrades[upgradeId].requirements!.weaponIds!.includes(
        world.state.weaponType,
      )
    ) {
      continue;
    }
    world.progression.upgradeRanks[upgradeId] =
      config.upgrades[upgradeId].maxRank;
  }
  world.state.elapsed = 120;
}
