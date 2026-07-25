import { describe, expect, it } from "vitest";
import { ArenaSession } from "../../application/ArenaSession";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import { UPGRADE_IDS } from "../../domain/types";
import { enterDebugExProtocolStory } from "./DebugExProtocolStory";

describe("enterDebugExProtocolStory", () => {
  it("opens a non-recorded Pulse EX Protocol selection with a completed build", () => {
    const session = new ArenaSession(SIMULATION_CONFIG);
    session.start({
      seed: 20260725,
      weaponType: "pulse",
      status: "paused",
      modeId: "debug-ex",
      stageId: "debug-ex-protocol",
      rulesetProfileId: "debug-ex-protocol-v08",
    });

    const result = enterDebugExProtocolStory(session.world, session.config);

    expect(session.recordPolicy).toBe("none");
    expect(session.rulesetProfile.rankPolicy).toBe("none");
    expect(session.world.state.status).toBe("protocolSelect");
    expect(session.world.progression.buildCompletedAt).toBe(0);
    expect(session.world.progression.xpToNext).toBe(1);
    expect(session.world.progression.pendingChoice).toMatchObject({
      kind: "protocol",
      choices: [
        "pulse.resonance-relay",
        "pulse.rebound-overdrive",
        "pulse.redline-core",
      ],
    });
    expect(
      UPGRADE_IDS.every(
        (upgradeId) =>
          session.world.progression.upgradeRanks[upgradeId] ===
          session.config.upgrades[upgradeId].maxRank,
      ),
    ).toBe(true);
    expect(result.events.map((event) => event.type)).toEqual([
      "build.completed",
      "ex.protocol.offered",
    ]);
  });
});
