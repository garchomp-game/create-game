import { describe, expect, it } from "vitest";
import { ArenaSession } from "../src/application/ArenaSession";
import { EX_PROTOCOL_CATALOG } from "../src/content/exProtocolCatalog";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type {
  GameEvent,
  InputSnapshot,
  WorldState,
} from "../src/domain/types";
import {
  chooseExProtocol,
} from "../src/simulation/exProtocolProgression";
import { completeBuild } from "../src/simulation/systems/levelSystem";

const SIGNATURES = EX_PROTOCOL_CATALOG.protocols.map(
  (protocol, index) => ({
    id: protocol.id,
    weaponId: protocol.weaponId,
    protocolIndex: index % 3,
  }),
);

const IDLE_INPUT: InputSnapshot = {
  move: { x: 0, y: 0 },
  aimWorld: { x: 800, y: 270 },
  startPressed: false,
  shootHeld: true,
  restartPressed: false,
  pausePressed: false,
  quitToTitlePressed: false,
  upgradeChoicePressed: null,
  contractChoicePressed: null,
  tutorialContinuePressed: false,
  specialPressed: false,
};

describe("EX Protocol deterministic signature probes", () => {
  it.each(SIGNATURES)(
    "$id replays the same input tape to an identical full digest",
    ({ weaponId, protocolIndex }) => {
      const left = createSignatureSession(
        weaponId,
        protocolIndex,
      );
      const right = createSignatureSession(
        weaponId,
        protocolIndex,
      );
      prepareActiveCharge(left.world);
      prepareActiveCharge(right.world);
      const leftEvents: GameEvent[] = [];
      const rightEvents: GameEvent[] = [];
      const tape: InputSnapshot[] = Array.from(
        { length: 600 },
        (_, frame) => ({
          ...IDLE_INPUT,
          move: {
            x: frame % 240 < 120 ? 0.6 : -0.6,
            y: frame % 180 < 90 ? -0.25 : 0.25,
          },
          aimWorld: {
            x: 480 + Math.cos(frame / 45) * 320,
            y: 270 + Math.sin(frame / 45) * 180,
          },
          specialPressed: frame === 0 || frame === 360,
        }),
      );

      for (const input of tape) {
        leftEvents.push(...left.step(input, 1 / 60).events);
        rightEvents.push(...right.step(input, 1 / 60).events);
      }

      const inputHash = stableHash(JSON.stringify(tape));
      const leftEventHash = stableHash(JSON.stringify(leftEvents));
      const rightEventHash = stableHash(JSON.stringify(rightEvents));
      const leftWorldHash = stableHash(JSON.stringify(left.world));
      const rightWorldHash = stableHash(JSON.stringify(right.world));
      expect(inputHash).not.toBe("00000000");
      expect(rightEventHash).toBe(leftEventHash);
      expect(rightWorldHash).toBe(leftWorldHash);
      expect(right.world).toEqual(left.world);
    },
  );
});

function createSignatureSession(
  weaponId: "pulse" | "spread",
  protocolIndex: number,
): ArenaSession {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260723,
    weaponType: weaponId,
    rulesetProfileId: "candidate-ex-endless-c1",
  });
  completeNormalBuild(session.world);
  const events: GameEvent[] = [];
  completeBuild(session.world, session.config, events);
  expect(
    chooseExProtocol(
      session.world,
      protocolIndex,
      session.config,
      events,
    ),
  ).toBe(true);
  return session;
}

function completeNormalBuild(world: WorldState): void {
  for (const upgradeId of Object.keys(
    world.progression.upgradeRanks,
  ) as Array<keyof typeof world.progression.upgradeRanks>) {
    const definition = SIMULATION_CONFIG.upgrades[upgradeId];
    const weapons = definition.requirements?.weaponIds;
    if (weapons && !weapons.includes(world.state.weaponType)) continue;
    world.progression.upgradeRanks[upgradeId] = definition.maxRank;
  }
}

function prepareActiveCharge(world: WorldState): void {
  const progression = world.progression.exProtocol;
  if (progression?.status !== "selected") return;
  if (
    progression.runtime.kind === "full-span-tidal-sweep" ||
    progression.runtime.kind === "breakwater-fan"
  ) {
    progression.runtime.charges = 1;
  }
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
