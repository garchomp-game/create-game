import type { EnemyTypeId } from "./types";

export const PRACTICE_INTENSITY_IDS = ["relaxed", "standard", "busy"] as const;

export type PracticeIntensityId = (typeof PRACTICE_INTENSITY_IDS)[number];

export type PracticeRunOptions = {
  invincible: boolean;
  intensity: PracticeIntensityId;
  enemyTypeIds: EnemyTypeId[];
};

export type PracticeRuntimeState = {
  options: PracticeRunOptions;
};

export function createDefaultPracticeRunOptions(): PracticeRunOptions {
  return {
    invincible: true,
    intensity: "relaxed",
    enemyTypeIds: ["chaser", "brute"],
  };
}

export function clonePracticeRunOptions(
  options: PracticeRunOptions,
): PracticeRunOptions {
  return {
    invincible: options.invincible,
    intensity: options.intensity,
    enemyTypeIds: [...options.enemyTypeIds],
  };
}

export function cyclePracticeIntensity(
  intensity: PracticeIntensityId,
  direction: -1 | 1 = 1,
): PracticeIntensityId {
  const index = PRACTICE_INTENSITY_IDS.indexOf(intensity);
  const nextIndex =
    (index + direction + PRACTICE_INTENSITY_IDS.length) %
    PRACTICE_INTENSITY_IDS.length;
  return PRACTICE_INTENSITY_IDS[nextIndex]!;
}

export function togglePracticeEnemy(
  options: PracticeRunOptions,
  enemyTypeId: EnemyTypeId,
): PracticeRunOptions | null {
  const selected = options.enemyTypeIds.includes(enemyTypeId);
  if (selected && options.enemyTypeIds.length === 1) return null;
  return {
    ...clonePracticeRunOptions(options),
    enemyTypeIds: selected
      ? options.enemyTypeIds.filter((typeId) => typeId !== enemyTypeId)
      : [...options.enemyTypeIds, enemyTypeId],
  };
}
