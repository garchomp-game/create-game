import { describe, expect, it } from "vitest";
import { ArenaSession } from "../src/application/ArenaSession";
import { SIMULATION_CONFIG } from "../src/config/gameConfig";
import type { ExProtocolRuntime } from "../src/domain/exProtocols";
import type { Enemy, InputSnapshot } from "../src/domain/types";
import {
  chooseExProtocol,
  offerExProtocolSelection,
} from "../src/simulation/exProtocolProgression";
import {
  createExProtocolProbeInput,
  shouldPressSpecial,
  type ExProtocolProbePath,
} from "./exProtocolProbePolicy";

const BASE_INPUT: InputSnapshot = {
  move: { x: 0.25, y: -0.5 },
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

describe("EX Protocol probe policy", () => {
  it("selects the requested fixed Protocol instead of a fallback", () => {
    const session = createSession("pulse");
    offerExProtocolSelection(session.world, session.config, []);
    const path: ExProtocolProbePath = {
      protocolId: "pulse.redline-core",
      evolutionOneId: "stabilized-core",
      evolutionTwoId: "long-burn",
    };

    expect(
      createExProtocolProbeInput(
        session.world,
        session.config,
        BASE_INPUT,
        path,
      ).upgradeChoicePressed,
    ).toBe(2);
  });

  it("arms Rebound only when the next normal volley can consume it", () => {
    const session = selectProtocol("pulse", 1);
    const runtime = requireRuntime(session, "rebound-overdrive");
    session.world.state.shotTimer = 0.04;
    runtime.cooldownUntil = session.world.state.elapsed;

    expect(shouldPressSpecial(session.world, session.config)).toBe(true);
    runtime.armedUntil = session.world.state.elapsed + 1;
    expect(shouldPressSpecial(session.world, session.config)).toBe(false);
  });

  it("spends Tidal and Breakwater charge only into a forward cluster", () => {
    const tidal = selectProtocol("spread", 0);
    const tidalRuntime = requireRuntime(
      tidal,
      "full-span-tidal-sweep",
    );
    tidalRuntime.charges = 1;
    tidal.world.enemies = createCluster(3, 120);
    expect(shouldPressSpecial(tidal.world, tidal.config)).toBe(true);
    tidal.world.enemies[2]!.position.x = -100;
    expect(shouldPressSpecial(tidal.world, tidal.config)).toBe(false);

    const breakwater = selectProtocol("spread", 1);
    const breakwaterRuntime = requireRuntime(
      breakwater,
      "breakwater-fan",
    );
    breakwaterRuntime.charges = 1;
    breakwaterRuntime.cooldownUntil = 0;
    breakwater.world.state.hp = 100;
    breakwater.world.enemies = createCluster(3, 110);
    expect(
      shouldPressSpecial(breakwater.world, breakwater.config),
    ).toBe(true);
    breakwater.world.state.hp = breakwaterRuntime.hpCostAtSelection;
    expect(
      shouldPressSpecial(breakwater.world, breakwater.config),
    ).toBe(false);
  });

  it("leaves passive Protocol aiming under the shared fair policy", () => {
    const tidal = selectProtocol("spread", 0);
    const tidalPath: ExProtocolProbePath = {
      protocolId: "spread.full-span-tidal-sweep",
      evolutionOneId: "wide-wake",
      evolutionTwoId: "double-reservoir",
    };
    tidal.world.enemies = createCluster(3, 120);
    const input = createExProtocolProbeInput(
      tidal.world,
      tidal.config,
      BASE_INPUT,
      tidalPath,
    );
    expect(input.aimWorld).toEqual(BASE_INPUT.aimWorld);
  });
});

function createSession(weaponType: "pulse" | "spread"): ArenaSession {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260723,
    weaponType,
    rulesetProfileId: "candidate-ex-endless-c1",
  });
  return session;
}

function selectProtocol(
  weaponType: "pulse" | "spread",
  choiceIndex: number,
): ArenaSession {
  const session = createSession(weaponType);
  offerExProtocolSelection(session.world, session.config, []);
  expect(
    chooseExProtocol(
      session.world,
      choiceIndex,
      session.config,
      [],
    ),
  ).toBe(true);
  return session;
}

function requireRuntime<TKind extends ExProtocolRuntime["kind"]>(
  session: ArenaSession,
  kind: TKind,
): Extract<ExProtocolRuntime, { kind: TKind }> {
  const progression = session.world.progression.exProtocol;
  if (
    progression?.status !== "selected" ||
    progression.runtime.kind !== kind
  ) {
    throw new Error(`Expected ${kind} runtime.`);
  }
  return progression.runtime as Extract<
    typeof progression.runtime,
    { kind: TKind }
  >;
}

function createCluster(count: number, x: number): Enemy[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `probe-enemy-${index}`,
    typeId: "chaser",
    position: { x: 480 + x, y: 240 + index * 30 },
    radius: 12,
    hp: 10,
    damage: 4,
    speed: 0,
    score: 10,
    xpValue: 1,
    behavior: "chase",
    attackTimer: 0,
    enteredArena: true,
  }));
}
