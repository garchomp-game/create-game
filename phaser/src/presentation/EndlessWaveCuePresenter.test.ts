import { describe, expect, it } from "vitest";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import { createEndlessWaveCueViewModel } from "./EndlessWaveCuePresenter";

describe("createEndlessWaveCueViewModel", () => {
  it("warns before the first density increase without duplicating wave times", () => {
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 25.9)).toBeNull();
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 26)).toEqual({
      kind: "warning",
      text: "敵影増加まで 4秒",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 29.2)).toEqual({
      kind: "warning",
      text: "敵影増加まで 1秒",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 30)).toEqual({
      kind: "pressure",
      text: "敵影増加 / 進路を確保",
    });
  });

  it("uses the slower 45-second band as an explicit recovery window", () => {
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 41)).toEqual({
      kind: "warning",
      text: "重装体接近まで 4秒",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 45)).toEqual({
      kind: "relief",
      text: "再編時間 5秒 / 重装体投入 / 大型を狙う",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 49.2)).toEqual({
      kind: "relief",
      text: "再編時間 1秒 / 重装体投入 / 大型を狙う",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 50)).toBeNull();
  });

  it("announces each later enemy role before it appears", () => {
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 56)).toEqual({
      kind: "warning",
      text: "高速体接近まで 4秒",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 60)).toEqual({
      kind: "pressure",
      text: "高速体投入 / 距離を取る",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 71)).toEqual({
      kind: "warning",
      text: "射撃体接近まで 4秒",
    });
    expect(createEndlessWaveCueViewModel(SIMULATION_CONFIG, 75)).toEqual({
      kind: "pressure",
      text: "射撃体投入 / 射線から外れる",
    });
  });
});
