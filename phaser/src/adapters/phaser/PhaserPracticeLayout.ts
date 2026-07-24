export type PracticeControlBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getPracticeSettingsButtonBounds(
  arenaWidth: number,
): PracticeControlBounds {
  return {
    x: arenaWidth / 2 - 60,
    y: 14,
    width: 120,
    height: 34,
  };
}

export function isPointInPracticeControl(
  bounds: PracticeControlBounds,
  x: number,
  y: number,
): boolean {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}
