import type { RandomSource } from "../domain/types";

export const RANDOM_STREAM_VERSION = "arena-rng-v1" as const;
export const RANDOM_STREAM_IDS = [
  "spawn",
  "upgrade",
  "drop",
  "encounter",
  "stageVariant",
] as const;

export type RandomStreamId = (typeof RANDOM_STREAM_IDS)[number];

export type RandomStreams = {
  version: typeof RANDOM_STREAM_VERSION;
  rootSeed: number;
  seeds: Record<RandomStreamId, number>;
  spawn: RandomSource;
  upgrade: RandomSource;
  drop: RandomSource;
  encounter: RandomSource;
  stageVariant: RandomSource;
};

export function createRandom(seed: number): RandomSource {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandomStreams(rootSeed: number): RandomStreams {
  const normalizedRootSeed = rootSeed >>> 0;
  const seeds = Object.fromEntries(
    RANDOM_STREAM_IDS.map((streamId) => [streamId, deriveRandomSeed(normalizedRootSeed, streamId)]),
  ) as Record<RandomStreamId, number>;
  seeds.spawn = normalizedRootSeed;

  return {
    version: RANDOM_STREAM_VERSION,
    rootSeed: normalizedRootSeed,
    seeds,
    spawn: createRandom(seeds.spawn),
    upgrade: createRandom(seeds.upgrade),
    drop: createRandom(seeds.drop),
    encounter: createRandom(seeds.encounter),
    stageVariant: createRandom(seeds.stageVariant),
  };
}

export function deriveRandomSeed(rootSeed: number, streamId: RandomStreamId): number {
  let hash = (rootSeed ^ 0x811c9dc5) >>> 0;
  for (let index = 0; index < streamId.length; index += 1) {
    hash ^= streamId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 0x6d2b79f5;
}
