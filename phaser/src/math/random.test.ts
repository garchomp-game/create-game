import { describe, expect, it } from "vitest";
import {
  RANDOM_STREAM_VERSION,
  RANDOM_STREAM_VERSION_V2,
  createRandom,
  createRandomStreams,
  deriveRandomSeed,
} from "./random";

describe("createRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = createRandom(20260619);
    const b = createRandom(20260619);

    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it("derives stable, independent random streams from one root seed", () => {
    const baseline = createRandomStreams(20260619);
    const withExtraDropDraws = createRandomStreams(20260619);
    Array.from({ length: 20 }, () => withExtraDropDraws.drop());

    expect(baseline.version).toBe(RANDOM_STREAM_VERSION);
    expect(baseline.seeds).toEqual({
      spawn: 20260619,
      upgrade: deriveRandomSeed(20260619, "upgrade"),
      drop: deriveRandomSeed(20260619, "drop"),
      encounter: deriveRandomSeed(20260619, "encounter"),
      stageVariant: deriveRandomSeed(20260619, "stageVariant"),
    });
    expect(Array.from({ length: 5 }, () => baseline.upgrade())).toEqual(
      Array.from({ length: 5 }, () => withExtraDropDraws.upgrade()),
    );
  });

  it("adds a reserved EX Protocol stream only for RNG v2", () => {
    const legacy = createRandomStreams(20260619);
    const candidate = createRandomStreams(
      20260619,
      RANDOM_STREAM_VERSION_V2,
    );

    expect(legacy.version).toBe(RANDOM_STREAM_VERSION);
    expect("exProtocol" in legacy).toBe(false);
    expect("exProtocol" in legacy.seeds).toBe(false);
    expect(candidate.version).toBe(RANDOM_STREAM_VERSION_V2);
    expect(candidate.seeds).toMatchObject(legacy.seeds);
    expect(candidate.seeds.exProtocol).toBe(
      deriveRandomSeed(20260619, "exProtocol"),
    );
    expect(candidate.exProtocol()).toBe(
      createRandom(candidate.seeds.exProtocol)(),
    );
  });

  it("keeps spawn draws independent from upgrade draws", () => {
    const baseline = createRandomStreams(42);
    const withExtraUpgradeDraws = createRandomStreams(42);
    Array.from({ length: 10 }, () => withExtraUpgradeDraws.upgrade());

    expect(Array.from({ length: 5 }, () => baseline.spawn())).toEqual(
      Array.from({ length: 5 }, () => withExtraUpgradeDraws.spawn()),
    );
  });
});
