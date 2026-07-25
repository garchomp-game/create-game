import { describe, expect, it } from "vitest";
import type { WeaponTypeId } from "../src/domain/types";
import {
  screenChargerMachineControl,
  type ChargerControlMachineRun,
} from "./chargerControlMachineProbe";
import { runExpedition } from "./v07ExpeditionProbe";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_SEEDS = [
  20260717,
  20260718,
  20260719,
  20260720,
  20260721,
  20260722,
] as const;
const SEEDS = readSeeds();
const WEAPONS: readonly WeaponTypeId[] = ["pulse", "spread"];

describe("Charger control machine screening", () => {
  it("records control opportunities without changing the runtime", () => {
    const runs = WEAPONS.flatMap((weaponType) =>
      SEEDS.map((seed) => toMachineRun(runExpedition(weaponType, seed))),
    );
    const byWeapon = Object.fromEntries(
      WEAPONS.map((weaponType) => [
        weaponType,
        screenChargerMachineControl(
          runs.filter((run) => run.weaponType === weaponType),
        ),
      ]),
    );
    const overall = screenChargerMachineControl(runs);

    console.log(
      JSON.stringify(
        { policy: "machine-screening-v1", overall, byWeapon, runs },
        null,
        2,
      ),
    );

    expect(runs).toHaveLength(SEEDS.length * WEAPONS.length);
    for (const run of runs) {
      expect(run.telegraphs).toBeGreaterThanOrEqual(run.charges);
      expect(run.killedBeforeTelegraph).toBeLessThanOrEqual(run.spawned);
      expect(
        run.obstacleInterruptions + run.boundaryInterruptions,
      ).toBeLessThanOrEqual(run.charges);
    }
    expect(overall.runs).toBe(runs.length);
  }, 900_000);
});

function toMachineRun(result: ReturnType<typeof runExpedition>): ChargerControlMachineRun {
  return {
    weaponType: result.weaponType,
    seed: result.seed,
    outcome: result.outcome,
    spawned: result.chargerSpawned,
    telegraphs: result.chargerTelegraphs,
    charges: result.chargerCharges,
    killedBeforeTelegraph: result.chargerKilledBeforeTelegraph,
    obstacleInterruptions: result.chargerObstacleInterruptions,
    boundaryInterruptions: result.chargerBoundaryInterruptions,
    playerHits: result.chargerPlayerHits,
  };
}

function readSeeds(): number[] {
  const value = process.env.ARENA_CHARGER_CONTROL_SEEDS;
  if (!value) return [...DEFAULT_SEEDS];
  const seeds = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0);
  if (seeds.length === 0) {
    throw new Error("ARENA_CHARGER_CONTROL_SEEDS must contain at least one seed.");
  }
  return seeds;
}
