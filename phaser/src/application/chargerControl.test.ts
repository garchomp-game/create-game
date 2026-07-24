import { describe, expect, it } from "vitest";
import type {
  ChargerControlGateObservation,
  ChargerControlSample,
} from "../domain/chargerControl";
import type { ObservedGameEvent } from "../domain/runFacts";
import type { GameEvent } from "../domain/types";
import {
  aggregateChargerControl,
} from "./chargerControl";
import {
  createChargerControlGateObservation,
  createChargerControlGateObservationFromStats,
  evaluateChargerControlGate,
} from "./chargerControlGate";

describe("aggregateChargerControl", () => {
  it("separates telegraph, charge, interruption, recovery, and kill facts", () => {
    const model = aggregateChargerControl([
      observed(0, 0, { type: "game.started" }),
      charger(1, 61, "enemy.charger.spawned", "charger-1"),
      charger(2, 62, "enemy.charger.telegraph.started", "charger-1"),
      charger(3, 62.6, "enemy.charger.prepare.started", "charger-1"),
      charger(4, 62.9, "enemy.charger.charge.started", "charger-1"),
      charger(5, 63.2, "enemy.charger.player.hit", "charger-1"),
      charger(6, 63.5, "enemy.charger.charge.ended", "charger-1", "obstacle"),
      charger(7, 64.5, "enemy.charger.recovered", "charger-1"),
      charger(8, 65, "enemy.charger.killed", "charger-1"),
    ]);

    expect(model.validation).toEqual({ state: "available" });
    expect(model.summary).toMatchObject({
      opportunityState: "observed",
      spawned: 1,
      killed: 1,
      killedBeforeTelegraph: 0,
      enemiesTelegraphed: 1,
      charges: 1,
      obstacleInterruptions: 1,
      boundaryInterruptions: 0,
      recoveries: 1,
      playerHits: 1,
    });
    expect(model.attempts[0]).toMatchObject({
      enemyId: "charger-1",
      firstTelegraphAt: 62,
      killedBeforeTelegraph: false,
      kill: { phase: "recovery", weaponId: "pulse" },
    });
  });

  it("counts a kill before the first telegraph without inferring a charge", () => {
    const model = aggregateChargerControl([
      charger(1, 61, "enemy.charger.spawned", "charger-fast-kill"),
      charger(2, 61.2, "enemy.charger.killed", "charger-fast-kill", "approach"),
    ]);

    expect(model.summary).toMatchObject({
      spawned: 1,
      killed: 1,
      killedBeforeTelegraph: 1,
      telegraphs: 0,
      charges: 0,
    });
    expect(model.attempts[0]?.killedBeforeTelegraph).toBe(true);
  });

  it("returns the same ordered model for shuffled input", () => {
    const events = [
      charger(10, 70, "enemy.charger.spawned", "charger-b"),
      charger(4, 61, "enemy.charger.spawned", "charger-a"),
      charger(6, 62, "enemy.charger.telegraph.started", "charger-a"),
      charger(7, 63, "enemy.charger.charge.started", "charger-a"),
    ];

    expect(aggregateChargerControl(events)).toEqual(
      aggregateChargerControl([...events].reverse()),
    );
    expect(aggregateChargerControl(events).attempts.map((attempt) => attempt.enemyId))
      .toEqual(["charger-a", "charger-b"]);
  });

  it("keeps a valid not-reached state when no Charger event exists", () => {
    const model = aggregateChargerControl([
      observed(0, 0, { type: "game.started" }),
    ]);

    expect(model.validation).toEqual({ state: "available" });
    expect(model.summary).toMatchObject({
      opportunityState: "not-reached",
      spawned: 0,
      charges: 0,
    });
  });

  it("rejects lifecycle events without a spawn and duplicate sequences", () => {
    const model = aggregateChargerControl([
      charger(2, 62, "enemy.charger.telegraph.started", "missing"),
      observed(2, 63, { type: "game.started" }),
    ]);

    expect(model.validation).toMatchObject({
      state: "invalid",
      issues: expect.arrayContaining([
        { code: "duplicateSequence", sequence: 2 },
        {
          code: "eventBeforeSpawn",
          enemyId: "missing",
          eventType: "enemy.charger.telegraph.started",
          sequence: 2,
        },
      ]),
    });
    expect(model.summary).toBeNull();
  });
});

describe("evaluateChargerControlGate", () => {
  it("stops when two of the first three experienced participants kill before telegraph", () => {
    const result = evaluateChargerControlGate([
      sample("E01", 1, modelWith({ killedBeforeTelegraph: 1, charges: 0 })),
      sample("E02", 2, modelWith({ killedBeforeTelegraph: 1, charges: 0 })),
      sample("E03", 3, modelWith({ killedBeforeTelegraph: 0, charges: 1 })),
    ]);

    expect(result).toMatchObject({
      decision: "stop",
      reasons: ["pre-telegraph-kills-too-common", "charges-too-rare"],
      firstExperiencedParticipantIds: ["E01", "E02", "E03"],
      participantsWithPreTelegraphKill: 2,
    });
  });

  it("stops when most reached skilled runs contain no charge", () => {
    const result = evaluateChargerControlGate([
      sample("E01", 1, modelWith({ charges: 0 })),
      sample("E02", 2, modelWith({ charges: 0 })),
      sample("E03", 3, modelWith({ charges: 1 })),
    ]);

    expect(result).toMatchObject({
      decision: "stop",
      reasons: ["charges-too-rare"],
      skilledReachedRuns: 3,
      skilledRunsWithoutCharge: 2,
    });
  });

  it("passes only after both enrollment and skilled-run evidence are sufficient", () => {
    const result = evaluateChargerControlGate([
      sample("E01", 1, modelWith({ charges: 1 })),
      sample("E02", 2, modelWith({ charges: 1 })),
      sample("E03", 3, modelWith({ charges: 0 })),
    ]);

    expect(result).toMatchObject({
      decision: "pass",
      reasons: [],
      skilledReachedRuns: 3,
      skilledRunsWithoutCharge: 1,
    });
  });

  it("does not treat a skilled run with no Charger spawn as a failed opportunity", () => {
    const result = evaluateChargerControlGate([
      sample("E01", 1, modelWith({ charges: 1 })),
      sample("E02", 2, modelWith({ charges: 1 })),
      sample("E03", 3, modelWith({ spawned: 0, charges: 0 })),
    ]);

    expect(result).toMatchObject({
      decision: "insufficient-data",
      reasons: ["skilled-reached-runs-pending"],
      skilledReachedRuns: 2,
    });
  });

  it("accepts the same gate facts from an event model or saved run stats", () => {
    const eventModel = aggregateChargerControl([
      charger(1, 61, "enemy.charger.spawned", "charger-1"),
      charger(2, 62, "enemy.charger.telegraph.started", "charger-1"),
      charger(3, 63, "enemy.charger.charge.started", "charger-1"),
    ]);
    const fromEvents = createChargerControlGateObservation(eventModel);
    const fromStats = createChargerControlGateObservationFromStats({
      spawned: 1,
      telegraphs: 1,
      charges: 1,
      killedBeforeTelegraph: 0,
      playerHits: 0,
      avoided: 0,
      obstacleInterruptions: 0,
      boundaryInterruptions: 0,
      recoveries: 0,
      killed: 0,
      killsByWeapon: { pulse: 0, spread: 0, pierce: 0 },
    });

    expect(fromEvents).toEqual(fromStats);
  });
});

function observed(sequence: number, elapsed: number, event: GameEvent): ObservedGameEvent {
  return { sequence, elapsed, event };
}

function charger(
  sequence: number,
  elapsed: number,
  type: Extract<GameEvent, { type: `enemy.charger.${string}` }>["type"],
  enemyId: string,
  detail?: "timeout" | "obstacle" | "arenaBoundary" | "approach",
): ObservedGameEvent {
  const position = { x: 100, y: 100 };
  const direction = { x: 1, y: 0 };
  switch (type) {
    case "enemy.charger.spawned":
      return observed(sequence, elapsed, { type, enemyId, position });
    case "enemy.charger.telegraph.started":
    case "enemy.charger.prepare.started":
    case "enemy.charger.charge.started":
      return observed(sequence, elapsed, {
        type,
        enemyId,
        position,
        direction,
        duration: 0.5,
      });
    case "enemy.charger.charge.ended":
      return observed(sequence, elapsed, {
        type,
        enemyId,
        position,
        reason: detail === "timeout" || detail === "arenaBoundary" ? detail : "obstacle",
        hitPlayer: false,
        recoveryEndsAt: elapsed + 1,
      });
    case "enemy.charger.recovered":
      return observed(sequence, elapsed, { type, enemyId, position });
    case "enemy.charger.player.hit":
      return observed(sequence, elapsed, { type, enemyId, damage: 10 });
    case "enemy.charger.killed":
      return observed(sequence, elapsed, {
        type,
        enemyId,
        weaponType: "pulse",
        phase: detail === "approach" ? "approach" : "recovery",
        chargesStarted: detail === "approach" ? 0 : 1,
        position,
      });
  }
}

function sample(
  participantId: string,
  participantOrder: number,
  observation: ChargerControlGateObservation,
): ChargerControlSample {
  return {
    participantId,
    participantOrder,
    runId: `run-${participantId}`,
    runOrder: 1,
    cohort: "experienced",
    skilledRun: true,
    observation,
  };
}

function modelWith(
  values: Partial<Extract<ChargerControlGateObservation, { state: "available" }>>,
): ChargerControlGateObservation {
  const spawned = values.spawned ?? 1;
  return {
    state: "available",
    spawned,
    killedBeforeTelegraph: values.killedBeforeTelegraph ?? 0,
    charges: values.charges ?? 0,
  };
}
