import { describe, expect, it } from "vitest";
import {
  CHARGER_MACHINE_SCREENING_POLICY,
  screenChargerMachineControl,
  type ChargerControlMachineRun,
} from "./chargerControlMachineProbe";

describe("screenChargerMachineControl", () => {
  it("keeps the machine screen distinct from the human adoption gate", () => {
    const result = screenChargerMachineControl([
      run("pulse", 1, { charges: 1 }),
      run("pulse", 2, { charges: 1 }),
      run("pulse", 3, { charges: 0 }),
      run("spread", 1, { charges: 1 }),
      run("spread", 2, { charges: 1 }),
      run("spread", 3, { charges: 0 }),
    ]);

    expect(CHARGER_MACHINE_SCREENING_POLICY).toEqual({
      minimumReachedRunsPerWeapon: 3,
      noChargeWarningRatioExclusive: 0.5,
      preTelegraphKillWarningRatioInclusive: 0.5,
    });
    expect(result).toMatchObject({
      status: "clear",
      reasons: [],
      runs: 6,
      reachedRuns: 6,
      runsWithCharge: 4,
    });
  });

  it("reports insufficient data until every observed weapon has three reached runs", () => {
    const result = screenChargerMachineControl([
      run("pulse", 1, { charges: 1 }),
      run("pulse", 2, { charges: 1 }),
      run("spread", 1, { charges: 1 }),
      run("spread", 2, { charges: 1 }),
      run("spread", 3, { charges: 1 }),
    ]);

    expect(result).toMatchObject({
      status: "insufficient-data",
      reasons: ["reached-runs-pending"],
    });
  });

  it("warns when charges are rare or pre-telegraph kills dominate", () => {
    const result = screenChargerMachineControl([
      run("pulse", 1, { charges: 0, killedBeforeTelegraph: 1 }),
      run("pulse", 2, { charges: 0, killedBeforeTelegraph: 1 }),
      run("pulse", 3, { charges: 1 }),
    ]);

    expect(result).toMatchObject({
      status: "warning",
      reasons: ["charges-too-rare", "pre-telegraph-kills-too-common"],
      runsWithCharge: 1,
      runsWithPreTelegraphKill: 2,
    });
  });

  it("does not count a run without a Charger as a failed opportunity", () => {
    const result = screenChargerMachineControl([
      run("pulse", 1, { charges: 1 }),
      run("pulse", 2, { charges: 1 }),
      run("pulse", 3, { spawned: 0, telegraphs: 0, charges: 0 }),
    ]);

    expect(result).toMatchObject({
      status: "insufficient-data",
      reachedRuns: 2,
      runsWithCharge: 2,
    });
  });
});

function run(
  weaponType: ChargerControlMachineRun["weaponType"],
  seed: number,
  overrides: Partial<ChargerControlMachineRun> = {},
): ChargerControlMachineRun {
  return {
    weaponType,
    seed,
    outcome: "victory",
    spawned: 1,
    telegraphs: 1,
    charges: 1,
    killedBeforeTelegraph: 0,
    obstacleInterruptions: 0,
    boundaryInterruptions: 0,
    playerHits: 0,
    ...overrides,
  };
}
