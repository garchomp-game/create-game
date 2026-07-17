import { describe, expect, it } from "vitest";
import { FIRST_EXPEDITION_STAGE_DEFINITION } from "../content/gameContentCatalog";
import { SIMULATION_CONFIG } from "../config/gameConfig";
import type { GameEvent, WorldState } from "../domain/types";
import { createRandomStreams } from "../math/random";
import { createWorld } from "./createWorld";
import { ExpeditionController } from "./ExpeditionController";
import { spawnFirstExpeditionBoss } from "./systems/bossSystem";

describe("ExpeditionController", () => {
  it("runs a telegraphed card into a safe structured deployment", () => {
    const { controller, random, world } = createFixture(11);
    controller.update(world, random, SIMULATION_CONFIG, []);
    world.state.elapsed = world.expedition!.director.nextSelectionAt;

    const selected = controller.update(world, random, SIMULATION_CONFIG, []);
    expect(selected.some((event) => event.type === "expedition.encounter.selected")).toBe(true);

    world.state.elapsed =
      world.expedition!.director.selectedAt! +
      1.4;
    const active = controller.update(world, random, SIMULATION_CONFIG, []);

    expect(active.some((event) => event.type === "expedition.encounter.active.started")).toBe(true);
    expect(active).toContainEqual(
      expect.objectContaining({
        type: "expedition.spawn.deployed",
        cardId: "vanguard-arc",
      }),
    );
    expect(world.enemies.length).toBeGreaterThanOrEqual(2);
    expect(world.enemies.every((enemy) => !enemy.enteredArena)).toBe(true);
    expect(world.expedition!.spawnOverride).toMatchObject({ budget: 2 });
  });

  it("reserves the counterattack and breakthrough Acts for their signature enemies", () => {
    const commander = selectActCard(180, 22);
    expect(commander.events).toContainEqual(
      expect.objectContaining({
        type: "expedition.encounter.selected",
        cardId: "commander-counterattack",
      }),
    );
    commander.world.state.elapsed = commander.world.expedition!.director.selectedAt! + 2.2;
    const commanderActive = commander.controller.update(
      commander.world,
      commander.random,
      SIMULATION_CONFIG,
      [],
    );
    expect(commanderActive.some((event) => event.type === "elite.commander.spawned")).toBe(true);

    const charger = selectActCard(300, 33);
    expect(charger.events).toContainEqual(
      expect.objectContaining({
        type: "expedition.encounter.selected",
        cardId: "charger-breakthrough",
      }),
    );
    charger.world.state.elapsed = charger.world.expedition!.director.selectedAt! + 2;
    const chargerActive = charger.controller.update(
      charger.world,
      charger.random,
      SIMULATION_CONFIG,
      [],
    );
    expect(chargerActive.some((event) => event.type === "enemy.charger.spawned")).toBe(true);
  });

  it("records explicit victory and defeat boundaries", () => {
    const victory = createFixture(44);
    const spawnEvents: GameEvent[] = [];
    const boss = spawnFirstExpeditionBoss(victory.world, spawnEvents)!;
    victory.world.state.elapsed = 480;
    const killed: Extract<GameEvent, { type: "enemy.killed" }> = {
      type: "enemy.killed",
      bulletId: "bullet-victory",
      volleyId: 1,
      enemyId: boss.id,
      enemyType: boss.typeId,
      weaponType: "pulse",
      scoreAwarded: boss.score,
      xpAwarded: boss.xpValue,
      position: { ...boss.position },
    };
    const victoryEvents = victory.controller.update(
      victory.world,
      victory.random,
      SIMULATION_CONFIG,
      [killed],
    );
    expect(victoryEvents).toContainEqual(
      expect.objectContaining({ type: "expedition.completed", elapsed: 480 }),
    );
    expect(victoryEvents).toContainEqual(
      expect.objectContaining({ type: "game.over", elapsed: 480 }),
    );
    expect(victory.world).toMatchObject({
      state: { status: "gameOver" },
      expedition: { status: "victory", outcome: "victory" },
    });

    const defeat = createFixture(55);
    defeat.world.state.elapsed = 123;
    defeat.world.state.status = "gameOver";
    const gameOver: GameEvent = { type: "game.over", score: 10, elapsed: 123 };
    const defeatEvents = defeat.controller.update(
      defeat.world,
      defeat.random,
      SIMULATION_CONFIG,
      [gameOver],
    );
    expect(defeatEvents).toEqual([
      expect.objectContaining({ type: "expedition.failed", actId: "deployment" }),
    ]);
    expect(defeat.world.expedition).toMatchObject({
      status: "defeat",
      outcome: "defeat",
    });
  });

  it("replays the same card, direction, and placements for the same seed", () => {
    const first = captureOpening(77);
    const second = captureOpening(77);
    expect(second).toEqual(first);
  });

  it("crosses all five Acts without a meaningful gap over 120 seconds", () => {
    const fixture = createFixture(88);
    const events: GameEvent[] = [];
    for (let elapsed = 0; elapsed <= 420; elapsed += 0.25) {
      fixture.world.state.elapsed = elapsed;
      events.push(
        ...fixture.controller.update(
          fixture.world,
          fixture.random,
          SIMULATION_CONFIG,
          [],
        ),
      );
      fixture.world.enemies = fixture.world.enemies.filter((enemy) => enemy.boss);
      fixture.world.eliteState!.commanderIds.length = 0;
      fixture.world.enemyActionState!.chargerIds.length = 0;
    }

    expect(
      events
        .filter((event) => event.type === "expedition.act.changed")
        .map((event) => event.actId),
    ).toEqual([
      "deployment",
      "first-assault",
      "counterattack",
      "breakthrough",
      "command-ship",
    ]);
    const selectedCardIds = events
      .filter((event) => event.type === "expedition.encounter.selected")
      .map((event) => event.cardId);
    expect(selectedCardIds).toContain("commander-counterattack");
    expect(selectedCardIds).toContain("charger-breakthrough");
    expect(selectedCardIds).toContain("command-ship-showdown");
    expect(fixture.world.expedition!.director.metrics.longestMeaningfulGap).toBeLessThan(120);
    expect(events.some((event) => event.type === "boss.spawned")).toBe(true);
    expect(events.some((event) => event.type === "expedition.completed")).toBe(false);
  });
});

function selectActCard(elapsed: number, seed: number) {
  const fixture = createFixture(seed);
  fixture.world.state.elapsed = elapsed;
  fixture.world.expedition!.director.phase = "idle";
  fixture.world.expedition!.director.nextSelectionAt = elapsed;
  fixture.world.expedition!.director.cardBag = [];
  const events = fixture.controller.update(
    fixture.world,
    fixture.random,
    SIMULATION_CONFIG,
    [],
  );
  return { ...fixture, events };
}

function captureOpening(seed: number) {
  const fixture = createFixture(seed);
  fixture.controller.update(fixture.world, fixture.random, SIMULATION_CONFIG, []);
  fixture.world.state.elapsed = fixture.world.expedition!.director.nextSelectionAt;
  const selected = fixture.controller.update(
    fixture.world,
    fixture.random,
    SIMULATION_CONFIG,
    [],
  );
  fixture.world.state.elapsed = fixture.world.expedition!.director.selectedAt! + 1.4;
  const active = fixture.controller.update(
    fixture.world,
    fixture.random,
    SIMULATION_CONFIG,
    [],
  );
  return {
    selected,
    active,
    enemies: fixture.world.enemies.map((enemy) => ({
      typeId: enemy.typeId,
      position: enemy.position,
    })),
  };
}

function createFixture(seed: number): {
  controller: ExpeditionController;
  random: ReturnType<typeof createRandomStreams>;
  world: WorldState;
} {
  const controller = new ExpeditionController(FIRST_EXPEDITION_STAGE_DEFINITION);
  const random = createRandomStreams(seed);
  const world = createWorld(SIMULATION_CONFIG);
  controller.initialize(world, random);
  return { controller, random, world };
}
