import type { Enemy, Vec2 } from "../domain/types";

export type IndexedEnemy = {
  enemy: Enemy;
  index: number;
};

export class EnemySpatialIndex {
  private readonly rows = new Map<number, Map<number, IndexedEnemy[]>>();
  private readonly maximumEnemyRadius: number;

  constructor(
    enemies: readonly Enemy[],
    private readonly cellSize = 96,
  ) {
    if (cellSize <= 0) throw new Error("Enemy spatial index cell size must be positive.");
    let maximumRadius = 0;
    enemies.forEach((enemy, index) => {
      maximumRadius = Math.max(maximumRadius, enemy.radius);
      const cellX = Math.floor(enemy.position.x / cellSize);
      const cellY = Math.floor(enemy.position.y / cellSize);
      let row = this.rows.get(cellY);
      if (!row) {
        row = new Map();
        this.rows.set(cellY, row);
      }
      const bucket = row.get(cellX);
      const entry = { enemy, index };
      if (bucket) bucket.push(entry);
      else row.set(cellX, [entry]);
    });
    this.maximumEnemyRadius = maximumRadius;
  }

  querySegment(
    start: Vec2,
    end: Vec2,
    movingRadius: number,
  ): IndexedEnemy[] {
    const padding = Math.max(0, movingRadius) + this.maximumEnemyRadius;
    const minCellX = Math.floor(
      (Math.min(start.x, end.x) - padding) / this.cellSize,
    );
    const maxCellX = Math.floor(
      (Math.max(start.x, end.x) + padding) / this.cellSize,
    );
    const minCellY = Math.floor(
      (Math.min(start.y, end.y) - padding) / this.cellSize,
    );
    const maxCellY = Math.floor(
      (Math.max(start.y, end.y) + padding) / this.cellSize,
    );
    const candidates: IndexedEnemy[] = [];

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      const row = this.rows.get(cellY);
      if (!row) continue;
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const bucket = row.get(cellX);
        if (bucket) candidates.push(...bucket);
      }
    }
    return candidates;
  }
}
