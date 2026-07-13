import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createWorld } from "./createWorld";
import { createUpgradePreview, formatUpgradePreview } from "./upgradePreview";

describe("createUpgradePreview", () => {
  it("previews fire rate changes from the current runtime", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.fireIntervalMultiplier = 0.85;

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "rapidFire")).toEqual({
      stat: "fireRate",
      before: "9.8",
      after: "11.5",
      unit: "perSecond",
    });
  });

  it("previews movement speed changes", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "swiftStep")).toEqual({
      stat: "moveSpeed",
      before: "240",
      after: "269",
      unit: null,
    });
  });

  it("previews max HP changes using current max HP bonus", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.maxHpBonus = 20;

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "vitalCore")).toEqual({
      stat: "maxHp",
      before: "120",
      after: "140",
      unit: null,
    });
  });

  it("previews projectile speed, count, and hit capacity changes", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.projectileCountBonus = 1;
    world.runtime.hitCapacityBonus = 1;

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "overdriveRounds")).toEqual({
      stat: "shotSpeed",
      before: "520",
      after: "598",
      unit: null,
    });
    expect(createUpgradePreview(world, SIMULATION_CONFIG, "splitShot")).toEqual({
      stat: "projectiles",
      before: "2",
      after: "3",
      unit: null,
    });
    expect(createUpgradePreview(world, SIMULATION_CONFIG, "piercingRounds")).toEqual({
      stat: "hitCapacity",
      before: "2",
      after: "3",
      unit: null,
    });
  });

  it("formats preview text for compact upgrade buttons", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(formatUpgradePreview(createUpgradePreview(world, SIMULATION_CONFIG, "splitShot"))).toBe(
      "Projectiles: 1 -> 2",
    );
  });

  it("previews weapon-specific focus and sweep effects", () => {
    const world = createWorld(SIMULATION_CONFIG);
    expect(createUpgradePreview(world, SIMULATION_CONFIG, "pulseFocus")).toEqual({
      stat: "focusStacks",
      before: "0",
      after: "2",
      unit: null,
    });
    expect(formatUpgradePreview(createUpgradePreview(world, SIMULATION_CONFIG, "spreadSweep")))
      .toBe("Next volley reduction: 0% -> 30%");
  });

  it("formats localized preview text", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(
      formatUpgradePreview(
        createUpgradePreview(world, SIMULATION_CONFIG, "rapidFire"),
        {
          fireRate: "連射",
          moveSpeed: "移動速度",
          shotSpeed: "弾速",
          maxHp: "最大HP",
          projectiles: "弾数",
          hitCapacity: "命中可能数",
          ricochets: "跳弾回数",
          focusStacks: "集束上限",
          nextVolleyReduction: "次射撃短縮",
        },
        { perSecond: "/秒" },
      ),
    ).toBe("連射: 8.3/秒 -> 9.8/秒");
  });
});
