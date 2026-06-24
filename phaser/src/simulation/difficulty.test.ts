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
      spawnInterval: 0.75,
      speedMultiplier: 1.18,
      maxEnemies: 45,
    });
  });

  it("switches to the late band at 60 seconds", () => {
    expect(getDifficulty(60)).toEqual({
      spawnInterval: 0.55,
      speedMultiplier: 1.35,
      maxEnemies: 60,
    });
  });
});
