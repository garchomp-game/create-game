import { describe, expect, it } from "vitest";
import { getDifficulty } from "./difficulty";

describe("getDifficulty", () => {
  it("uses the early game band before 30 seconds", () => {
    expect(getDifficulty(29.999)).toEqual({
      spawnInterval: 1,
      speedMultiplier: 1,
      maxEnemies: 30,
    });
  });

  it("switches to the middle band at 30 seconds", () => {
    expect(getDifficulty(30)).toEqual({
      spawnInterval: 0.78,
      speedMultiplier: 1.14,
      maxEnemies: 42,
    });
  });

  it("switches to the ranged introduction band at 60 seconds", () => {
    expect(getDifficulty(60)).toEqual({
      spawnInterval: 0.68,
      speedMultiplier: 1.22,
      maxEnemies: 50,
    });
  });

  it("switches to the endurance band at 90 seconds", () => {
    expect(getDifficulty(90)).toEqual({
      spawnInterval: 0.55,
      speedMultiplier: 1.35,
      maxEnemies: 60,
    });
  });

  it("adds capped endless pressure after the endurance band", () => {
    expect(getDifficulty(150)).toEqual({
      spawnInterval: 0.535,
      speedMultiplier: 1.39,
      maxEnemies: 62,
    });
    expect(getDifficulty(570)).toEqual({
      spawnInterval: 0.43,
      speedMultiplier: 1.67,
      maxEnemies: 76,
    });
  });
});
