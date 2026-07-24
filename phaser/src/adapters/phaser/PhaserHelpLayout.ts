import type { HelpPage, MenuAction } from "../../application/ArenaMenuTypes";

export type HelpButtonBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HelpTabButtonBounds = HelpButtonBounds & {
  action: Extract<MenuAction, "helpControls" | "helpEnemies" | "helpField">;
  page: HelpPage;
};

export function getHelpTabButtonBounds(
  arenaWidth: number,
): HelpTabButtonBounds[] {
  const width = 150;
  const gap = 10;
  const totalWidth = width * 3 + gap * 2;
  const startX = (arenaWidth - totalWidth) / 2;
  return [
    {
      action: "helpControls",
      page: "controls",
      x: startX,
      y: 92,
      width,
      height: 38,
    },
    {
      action: "helpEnemies",
      page: "enemies",
      x: startX + width + gap,
      y: 92,
      width,
      height: 38,
    },
    {
      action: "helpField",
      page: "field",
      x: startX + (width + gap) * 2,
      y: 92,
      width,
      height: 38,
    },
  ];
}

export function getHelpHudButtonBounds(
  arenaWidth: number,
  arenaHeight: number,
): HelpButtonBounds {
  return {
    x: arenaWidth - 56,
    y: arenaHeight - 56,
    width: 36,
    height: 36,
  };
}

export function getHelpCloseButtonBounds(
  arenaWidth: number,
  arenaHeight: number,
): HelpButtonBounds {
  return {
    x: arenaWidth / 2 - 130,
    y: arenaHeight - 62,
    width: 260,
    height: 42,
  };
}

export function isPointInHelpBounds(
  bounds: HelpButtonBounds,
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
