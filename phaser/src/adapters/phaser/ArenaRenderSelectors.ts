import type { Vec2 } from "../../domain/types";

type ArenaSize = {
  width: number;
  height: number;
};

type Positioned = {
  position: Vec2;
};

export function selectNearestOffscreen<T extends Positioned>(
  items: readonly T[],
  playerPosition: Vec2,
  arena: ArenaSize,
  limit: number,
): T[] {
  if (limit <= 0) return [];

  const selected: T[] = [];
  const distanceSquares: number[] = [];
  for (const item of items) {
    if (!isOutsideArena(item.position, arena)) continue;

    const dx = playerPosition.x - item.position.x;
    const dy = playerPosition.y - item.position.y;
    const distanceSquared = dx * dx + dy * dy;
    if (
      selected.length >= limit &&
      distanceSquared >= distanceSquares[distanceSquares.length - 1]!
    ) {
      continue;
    }

    let insertAt = 0;
    while (
      insertAt < distanceSquares.length &&
      distanceSquares[insertAt]! <= distanceSquared
    ) {
      insertAt += 1;
    }
    selected.splice(insertAt, 0, item);
    distanceSquares.splice(insertAt, 0, distanceSquared);
    if (selected.length > limit) {
      selected.pop();
      distanceSquares.pop();
    }
  }
  return selected;
}

function isOutsideArena(position: Vec2, arena: ArenaSize): boolean {
  return (
    position.x < 0 ||
    position.x > arena.width ||
    position.y < 0 ||
    position.y > arena.height
  );
}
