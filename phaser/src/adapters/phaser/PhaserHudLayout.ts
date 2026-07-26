export const HUD_LEFT_PANEL_BOUNDS = {
  x: 16,
  y: 14,
  width: 348,
  height: 82,
} as const;

const HUD_RIGHT_PANEL_OFFSET = 286;
const HUD_CENTER_GAP = 6;

export function getTacticalStatusDockBounds(arenaWidth: number) {
  const x =
    HUD_LEFT_PANEL_BOUNDS.x +
    HUD_LEFT_PANEL_BOUNDS.width +
    HUD_CENTER_GAP;
  const rightPanelX = arenaWidth - HUD_RIGHT_PANEL_OFFSET;
  return {
    x,
    y: HUD_LEFT_PANEL_BOUNDS.y,
    width: rightPanelX - x - HUD_CENTER_GAP,
    maxHeight: HUD_LEFT_PANEL_BOUNDS.height,
  };
}
