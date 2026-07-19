import type { WorldState } from "../domain/types";

export function getDifficultyElapsed(
  world: Pick<WorldState, "state" | "expedition">,
): number {
  const director = world.expedition?.director;
  if (!director) return world.state.elapsed;

  const pendingRunDelta = Math.max(0, world.state.elapsed - director.runElapsed);
  const elapsed = director.actElapsed +
    (director.actClockBlocked ? 0 : pendingRunDelta);
  return Math.round(elapsed * 1_000) / 1_000;
}
