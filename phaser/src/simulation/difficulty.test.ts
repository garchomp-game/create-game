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
      speedMultiplier: 1.02,
      maxEnemies: 32,
    });
  });

  it("opens the lower-density brute band at 45 seconds", () => {
    expect(getDifficulty(45)).toEqual({
      spawnInterval: 1.3,
      speedMultiplier: 1.04,
      maxEnemies: 36,
    });
  });

  it("raises mixed pressure at 60 seconds", () => {
    expect(getDifficulty(60)).toEqual({
      spawnInterval: 0.95,
      speedMultiplier: 1.1,
      maxEnemies: 42,
    });
  });

  it("introduces ranged enemies at 75 seconds", () => {
    expect(getDifficulty(75)).toEqual({
      spawnInterval: 0.78,
      speedMultiplier: 1.18,
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

  it("keeps adding endless pressure while capping screen-density values", () => {
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
    expect(getDifficulty(900)).toEqual({
      spawnInterval: 0.355,
      speedMultiplier: 1.87,
      maxEnemies: 86,
    });
  });
});
