import type {
  EnemyTypeId,
  SimulationConfig,
  WaveBand,
} from "../domain/types";

export type EndlessWaveCueViewModel = {
  kind: "warning" | "pressure" | "relief";
  text: string;
};

const WARNING_SECONDS = 4;
const ACTIVE_CUE_SECONDS = 4;
const RELIEF_SECONDS = 5;

export function createEndlessWaveCueViewModel(
  config: SimulationConfig,
  elapsed: number,
): EndlessWaveCueViewModel | null {
  const nextIndex = config.waves.findIndex((wave) => wave.start > elapsed);
  if (nextIndex > 0) {
    const nextWave = config.waves[nextIndex]!;
    const secondsUntil = nextWave.start - elapsed;
    if (secondsUntil <= WARNING_SECONDS) {
      const previousWave = config.waves[nextIndex - 1]!;
      return {
        kind: "warning",
        text: `${formatTransitionLabel(previousWave, nextWave, "warning")} ${Math.ceil(secondsUntil)}秒`,
      };
    }
  }

  const currentIndex = findCurrentWaveIndex(config.waves, elapsed);
  if (currentIndex <= 0) return null;
  const currentWave = config.waves[currentIndex]!;
  const previousWave = config.waves[currentIndex - 1]!;
  const age = elapsed - currentWave.start;
  const isRelief = currentWave.spawnInterval > previousWave.spawnInterval;
  const duration = isRelief ? RELIEF_SECONDS : ACTIVE_CUE_SECONDS;
  if (age < 0 || age >= duration) return null;

  if (isRelief) {
    return {
      kind: "relief",
      text: `再編時間 ${Math.ceil(duration - age)}秒 / ${formatTransitionLabel(previousWave, currentWave, "active")}`,
    };
  }
  return {
    kind: "pressure",
    text: formatTransitionLabel(previousWave, currentWave, "active"),
  };
}

function findCurrentWaveIndex(waves: WaveBand[], elapsed: number): number {
  let index = 0;
  for (let candidate = 1; candidate < waves.length; candidate += 1) {
    if (waves[candidate]!.start > elapsed) break;
    index = candidate;
  }
  return index;
}

function formatTransitionLabel(
  previous: WaveBand,
  next: WaveBand,
  phase: "warning" | "active",
): string {
  const introduced = getIntroducedEnemyTypes(previous, next);
  const primary = introduced[0];
  if (!primary) {
    return phase === "warning" ? "敵影増加まで" : "敵影増加 / 進路を確保";
  }
  if (phase === "warning") return `${formatEnemyType(primary)}接近まで`;
  if (primary === "brute") return "重装体投入 / 大型を狙う";
  if (primary === "fast") return "高速体投入 / 距離を取る";
  if (primary === "ranged") return "射撃体投入 / 射線から外れる";
  return `${formatEnemyType(primary)}投入`;
}

function getIntroducedEnemyTypes(
  previous: WaveBand,
  next: WaveBand,
): EnemyTypeId[] {
  return (Object.keys(next.enemyWeights) as EnemyTypeId[]).filter(
    (typeId) =>
      (next.enemyWeights[typeId] ?? 0) > 0 &&
      (previous.enemyWeights[typeId] ?? 0) <= 0,
  );
}

function formatEnemyType(typeId: EnemyTypeId): string {
  if (typeId === "brute") return "重装体";
  if (typeId === "fast") return "高速体";
  if (typeId === "ranged") return "射撃体";
  return "追跡体";
}
