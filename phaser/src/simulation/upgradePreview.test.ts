import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createWorld } from "./createWorld";
import { createUpgradePreview, formatUpgradePreview } from "./upgradePreview";

describe("createUpgradePreview", () => {
  it("previews fire rate changes from the current runtime", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.fireIntervalMultiplier = 0.85;

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "rapidFire")).toEqual({
      label: "Fire rate",
      before: "7.4/s",
      after: "8.7/s",
    });
  });

  it("previews movement speed changes", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "swiftStep")).toEqual({
      label: "Move speed",
      before: "240",
      after: "269",
    });
  });

  it("previews max HP changes using current max HP bonus", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.maxHpBonus = 20;

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "vitalCore")).toEqual({
      label: "Max HP",
      before: "120",
      after: "140",
    });
  });

  it("previews projectile speed, count, and pierce changes", () => {
    const world = createWorld(SIMULATION_CONFIG);
    world.runtime.projectileCountBonus = 1;
    world.runtime.pierceBonus = 1;

    expect(createUpgradePreview(world, SIMULATION_CONFIG, "overdriveRounds")).toEqual({
      label: "Shot speed",
      before: "520",
      after: "598",
    });
    expect(createUpgradePreview(world, SIMULATION_CONFIG, "splitShot")).toEqual({
      label: "Projectiles",
      before: "2",
      after: "3",
    });
    expect(createUpgradePreview(world, SIMULATION_CONFIG, "piercingRounds")).toEqual({
      label: "Pierce",
      before: "2",
      after: "3",
    });
  });

  it("formats preview text for compact upgrade buttons", () => {
    const world = createWorld(SIMULATION_CONFIG);

    expect(formatUpgradePreview(createUpgradePreview(world, SIMULATION_CONFIG, "splitShot"))).toBe(
      "Projectiles: 1 -> 2",
    );
  });
});
