import { describe, expect, it } from "vitest";
import { ArenaSession } from "../../application/ArenaSession";
import { SIMULATION_CONFIG } from "../../config/gameConfig";
import {
  applyCapacityIncrease,
  applyPlayerDamage,
  clampPlayerHpToCapacity,
  getPlayerCapacity,
  healPlayer,
  spendPlayerIntegrity,
} from "./playerHealthSystem";
import { chooseExProtocol } from "../exProtocolProgression";
import { completeBuild } from "./levelSystem";

describe("playerHealthSystem", () => {
  it("separates gross, effective, and reserved HP for Redline without damage", () => {
    const session = createRedlineSession();
    const { world, config } = session;
    const damageBefore = world.stats.damageTaken;

    expect(getPlayerCapacity(world, config)).toEqual({
      grossMaxHp: 100,
      effectiveMaxHp: 70,
      reservedHp: 30,
    });
    expect(world.state.hp).toBe(70);
    expect(clampPlayerHpToCapacity(world, config)).toBe(0);
    expect(world.stats.damageTaken).toBe(damageBefore);
  });

  it("distinguishes damage, integrity spend, healing, and capacity increase", () => {
    const session = createRedlineSession();
    const { world, config } = session;
    clampPlayerHpToCapacity(world, config);

    expect(applyPlayerDamage(world, 12)).toBe(12);
    expect(world.state.hp).toBe(58);
    expect(spendPlayerIntegrity(world, 10)).toEqual({
      accepted: true,
      spent: 10,
    });
    expect(world.state.hp).toBe(48);
    expect(spendPlayerIntegrity(world, 48)).toEqual({
      accepted: false,
      spent: 0,
    });
    expect(healPlayer(world, config, 100)).toBe(22);
    expect(world.state.hp).toBe(70);

    const before = getPlayerCapacity(world, config).effectiveMaxHp;
    world.runtime.maxHpBonus += 8;
    expect(applyCapacityIncrease(world, config, before, true)).toBe(5);
    expect(world.state.hp).toBe(75);
    expect(getPlayerCapacity(world, config)).toEqual({
      grossMaxHp: 108,
      effectiveMaxHp: 75,
      reservedHp: 33,
    });
  });
});

function createRedlineSession(): ArenaSession {
  const session = new ArenaSession(SIMULATION_CONFIG);
  session.start({
    seed: 20260723,
    weaponType: "pulse",
    rulesetProfileId: "candidate-ex-endless-c1",
  });
  for (const upgradeId of Object.keys(
    session.world.progression.upgradeRanks,
  ) as Array<keyof typeof session.world.progression.upgradeRanks>) {
    if (
      SIMULATION_CONFIG.upgrades[
        upgradeId
      ].requirements?.weaponIds?.includes("spread")
    ) {
      continue;
    }
    session.world.progression.upgradeRanks[upgradeId] =
      SIMULATION_CONFIG.upgrades[upgradeId].maxRank;
  }
  completeBuild(session.world, session.config, []);
  chooseExProtocol(session.world, 2, session.config, []);
  return session;
}
