import type { WeaponTypeId } from "../src/domain/types";

export type ChargerControlMachineRun = {
  weaponType: WeaponTypeId;
  seed: number;
  outcome: "victory" | "defeat" | null;
  spawned: number;
  telegraphs: number;
  charges: number;
  killedBeforeTelegraph: number;
  obstacleInterruptions: number;
  boundaryInterruptions: number;
  playerHits: number;
};

export type ChargerControlMachineScreening = {
  status: "clear" | "warning" | "insufficient-data";
  reasons: Array<
    | "reached-runs-pending"
    | "charges-too-rare"
    | "pre-telegraph-kills-too-common"
  >;
  runs: number;
  reachedRuns: number;
  runsWithCharge: number;
  runsWithPreTelegraphKill: number;
  spawned: number;
  telegraphs: number;
  charges: number;
  obstacleInterruptions: number;
  boundaryInterruptions: number;
  playerHits: number;
};

export const CHARGER_MACHINE_SCREENING_POLICY = {
  minimumReachedRunsPerWeapon: 3,
  noChargeWarningRatioExclusive: 0.5,
  preTelegraphKillWarningRatioInclusive: 0.5,
} as const;

export function screenChargerMachineControl(
  runs: readonly ChargerControlMachineRun[],
): ChargerControlMachineScreening {
  const reachedRuns = runs.filter((run) => run.spawned > 0);
  const runsWithCharge = reachedRuns.filter((run) => run.charges > 0).length;
  const runsWithPreTelegraphKill = reachedRuns.filter(
    (run) => run.killedBeforeTelegraph > 0,
  ).length;
  const reasons: ChargerControlMachineScreening["reasons"] = [];
  const reachedByWeapon = new Map<WeaponTypeId, number>();
  for (const run of reachedRuns) {
    reachedByWeapon.set(
      run.weaponType,
      (reachedByWeapon.get(run.weaponType) ?? 0) + 1,
    );
  }
  const observedWeapons = new Set(runs.map((run) => run.weaponType));

  if (
    observedWeapons.size === 0 ||
    [...observedWeapons].some(
      (weaponType) =>
        (reachedByWeapon.get(weaponType) ?? 0) <
        CHARGER_MACHINE_SCREENING_POLICY.minimumReachedRunsPerWeapon,
    )
  ) {
    reasons.push("reached-runs-pending");
  }
  if (
    reachedRuns.length > 0 &&
    (reachedRuns.length - runsWithCharge) / reachedRuns.length >
      CHARGER_MACHINE_SCREENING_POLICY.noChargeWarningRatioExclusive
  ) {
    reasons.push("charges-too-rare");
  }
  if (
    reachedRuns.length > 0 &&
    runsWithPreTelegraphKill / reachedRuns.length >=
      CHARGER_MACHINE_SCREENING_POLICY.preTelegraphKillWarningRatioInclusive
  ) {
    reasons.push("pre-telegraph-kills-too-common");
  }

  return {
    status:
      reasons.includes("reached-runs-pending")
        ? "insufficient-data"
        : reasons.length > 0
          ? "warning"
          : "clear",
    reasons,
    runs: runs.length,
    reachedRuns: reachedRuns.length,
    runsWithCharge,
    runsWithPreTelegraphKill,
    spawned: sum(reachedRuns, (run) => run.spawned),
    telegraphs: sum(reachedRuns, (run) => run.telegraphs),
    charges: sum(reachedRuns, (run) => run.charges),
    obstacleInterruptions: sum(
      reachedRuns,
      (run) => run.obstacleInterruptions,
    ),
    boundaryInterruptions: sum(
      reachedRuns,
      (run) => run.boundaryInterruptions,
    ),
    playerHits: sum(reachedRuns, (run) => run.playerHits),
  };
}

function sum(
  runs: readonly ChargerControlMachineRun[],
  select: (run: ChargerControlMachineRun) => number,
): number {
  return runs.reduce((total, run) => total + select(run), 0);
}
