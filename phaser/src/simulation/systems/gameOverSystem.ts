import type { GameEvent, WorldState } from "../../domain/types";

export function updateGameOver(world: WorldState, events: GameEvent[]): void {
  if (world.state.hp > 0) return;
  world.state.hp = 0;
  if (world.state.status === "gameOver") return;

  world.state.status = "gameOver";
  events.push({
    type: "game.over",
    score: world.state.score,
    elapsed: world.state.elapsed,
  });
}
