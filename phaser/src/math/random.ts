import type { RandomSource } from "../domain/types";

export const RANDOM_STREAM_VERSION = "arena-rng-v1" as const;
export const RANDOM_STREAM_VERSION_V2 = "arena-rng-v2" as const;
export type RandomStreamVersion =
  | typeof RANDOM_STREAM_VERSION
  | typeof RANDOM_STREAM_VERSION_V2;
export const LEGACY_RANDOM_STREAM_IDS = [
  "spawn",
  "upgrade",
  "drop",
  "encounter",
  "stageVariant",
] as const;
export const RANDOM_STREAM_IDS = LEGACY_RANDOM_STREAM_IDS;
export const RANDOM_STREAM_IDS_V2 = [
  ...LEGACY_RANDOM_STREAM_IDS,
  "exProtocol",
] as const;

export type LegacyRandomStreamId = (typeof LEGACY_RANDOM_STREAM_IDS)[number];
export type RandomStreamId = (typeof RANDOM_STREAM_IDS_V2)[number];

export type LegacyRandomStreams = {
  version: typeof RANDOM_STREAM_VERSION;
  rootSeed: number;
  seeds: Record<LegacyRandomStreamId, number>;
  spawn: RandomSource;
  upgrade: RandomSource;
  drop: RandomSource;
  encounter: RandomSource;
  stageVariant: RandomSource;
};

export type ExProtocolRandomStreams = {
  version: typeof RANDOM_STREAM_VERSION_V2;
  rootSeed: number;
  seeds: Record<RandomStreamId, number>;
  spawn: RandomSource;
  upgrade: RandomSource;
  drop: RandomSource;
  encounter: RandomSource;
  stageVariant: RandomSource;
  exProtocol: RandomSource;
};

export type RandomStreams = LegacyRandomStreams | ExProtocolRandomStreams;

export function createRandom(seed: number): RandomSource {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandomStreams(rootSeed: number): LegacyRandomStreams;
export function createRandomStreams(
  rootSeed: number,
  version: typeof RANDOM_STREAM_VERSION,
): LegacyRandomStreams;
export function createRandomStreams(
  rootSeed: number,
  version: typeof RANDOM_STREAM_VERSION_V2,
): ExProtocolRandomStreams;
export function createRandomStreams(
  rootSeed: number,
  version: RandomStreamVersion,
): RandomStreams;
export function createRandomStreams(
  rootSeed: number,
  version: RandomStreamVersion = RANDOM_STREAM_VERSION,
): RandomStreams {
  const normalizedRootSeed = rootSeed >>> 0;
  const streamIds =
    version === RANDOM_STREAM_VERSION
      ? LEGACY_RANDOM_STREAM_IDS
      : RANDOM_STREAM_IDS_V2;
  const seeds = Object.fromEntries(
    streamIds.map((streamId) => [
      streamId,
      deriveRandomSeed(normalizedRootSeed, streamId),
    ]),
  ) as Record<RandomStreamId, number>;
  seeds.spawn = normalizedRootSeed;

  const common = {
    version,
    rootSeed: normalizedRootSeed,
    seeds,
    spawn: createRandom(seeds.spawn),
    upgrade: createRandom(seeds.upgrade),
    drop: createRandom(seeds.drop),
    encounter: createRandom(seeds.encounter),
    stageVariant: createRandom(seeds.stageVariant),
  };
  if (version === RANDOM_STREAM_VERSION) {
    return common as LegacyRandomStreams;
  }
  return {
    ...common,
    version: RANDOM_STREAM_VERSION_V2,
    exProtocol: createRandom(seeds.exProtocol),
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
