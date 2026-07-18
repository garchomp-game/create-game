export const ARENA_THEME = {
  colors: {
    canvas: "#111318",
    overlay: "#020617",
    overlayStrong: "#05070d",
    surface: "#1f2937",
    surfaceFocused: "#164e63",
    autoPilotSurface: "#083344",
    barTrack: "#0f172a",
    border: "#64748b",
    borderStrong: "#425066",
    borderSubtle: "#334155",
    text: "#f8fafc",
    textStrong: "#ffffff",
    textMuted: "#cbd5e1",
    textSecondary: "#d5dce5",
    textSubtitle: "#aeb9c7",
    textSubtle: "#94a3b8",
    line: "#e2e8f0",
    focus: "#facc15",
    accent: "#38bdf8",
    accentBright: "#67e8f9",
    pulse: "#22b8cf",
    spread: "#f59e0b",
    success: "#34d399",
    danger: "#fb7185",
    dangerStrong: "#ef4444",
    warning: "#f97316",
    warningBright: "#fbbf24",
    healthy: "#22c55e",
    cyan: "#22d3ee",
  },
  typography: {
    domFontFamily:
      '"Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", sans-serif',
    canvasFontFamily: "Arial, sans-serif",
  },
  surfaces: {
    card: "rgba(19, 25, 34, 0.98)",
    cardHovered: "rgba(31, 40, 52, 0.99)",
  },
  radii: {
    badge: 4,
    control: 6,
    card: 7,
  },
  spacing: {
    focusOffset: 2,
    cardGap: 10,
    sectionGap: 18,
  },
} as const;

export type ArenaThemeColorName = keyof typeof ARENA_THEME.colors;

export function hexToPhaserColor(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a six-digit hex color, received: ${hex}`);
  }
  return Number.parseInt(hex.slice(1), 16);
}

export const ARENA_PHASER_COLORS = Object.freeze(
  Object.fromEntries(
    Object.entries(ARENA_THEME.colors).map(([name, value]) => [
      name,
      hexToPhaserColor(value),
    ]),
  ) as Record<ArenaThemeColorName, number>,
);
