import type { TutorialTarget } from "../domain/tutorial";
import type { Vec2 } from "../domain/types";
import type { ArenaTutorialCueKind } from "./ArenaTutorialPresenter";

export type TutorialMoveKey = "A" | "D" | "S" | "W";

const TARGET_AXIS_DEAD_ZONE = 12;
const WAYPOINT_REACHED_DISTANCE = 18;

export function getTutorialCueKeys(
  cueKind: ArenaTutorialCueKind,
  playerPosition: Vec2,
  target: TutorialTarget | null,
): ReadonlySet<TutorialMoveKey> {
  if (cueKind === "move" && !target) return new Set(["W", "A", "S", "D"]);
  if (cueKind === "dodge") return new Set(["W", "S"]);
  if ((cueKind !== "route" && cueKind !== "move") || !target) return new Set();

  const destination = getCurrentRouteDestination(playerPosition, target);
  const xDifference = destination.x - playerPosition.x;
  const yDifference = destination.y - playerPosition.y;
  const keys = new Set<TutorialMoveKey>();

  if (xDifference > TARGET_AXIS_DEAD_ZONE) keys.add("D");
  if (xDifference < -TARGET_AXIS_DEAD_ZONE) keys.add("A");
  if (yDifference > TARGET_AXIS_DEAD_ZONE) keys.add("S");
  if (yDifference < -TARGET_AXIS_DEAD_ZONE) keys.add("W");

  return keys;
}

export function getCurrentRouteDestination(
  playerPosition: Vec2,
  target: TutorialTarget,
): Vec2 {
  for (const point of target.guidePath ?? []) {
    if (distance(playerPosition, point) > WAYPOINT_REACHED_DISTANCE) {
      return point;
    }
  }
  return target.position;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
