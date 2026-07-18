import { ARENA_THEME } from "../../presentation/ArenaTheme";

export const ARENA_DOM_THEME_VARIABLES = {
  "--arena-color-overlay": ARENA_THEME.colors.overlay,
  "--arena-color-overlay-strong": ARENA_THEME.colors.overlayStrong,
  "--arena-color-surface": ARENA_THEME.colors.surface,
  "--arena-surface-card": ARENA_THEME.surfaces.card,
  "--arena-surface-card-hovered": ARENA_THEME.surfaces.cardHovered,
  "--arena-color-border": ARENA_THEME.colors.border,
  "--arena-color-border-strong": ARENA_THEME.colors.borderStrong,
  "--arena-color-text": ARENA_THEME.colors.text,
  "--arena-color-text-strong": ARENA_THEME.colors.textStrong,
  "--arena-color-text-secondary": ARENA_THEME.colors.textSecondary,
  "--arena-color-text-subtitle": ARENA_THEME.colors.textSubtitle,
  "--arena-color-text-subtle": ARENA_THEME.colors.textSubtle,
  "--arena-color-line": ARENA_THEME.colors.line,
  "--arena-color-focus": ARENA_THEME.colors.focus,
  "--arena-color-accent-bright": ARENA_THEME.colors.accentBright,
  "--arena-color-pulse": ARENA_THEME.colors.pulse,
  "--arena-color-spread": ARENA_THEME.colors.spread,
  "--arena-color-success": ARENA_THEME.colors.success,
  "--arena-color-danger": ARENA_THEME.colors.danger,
  "--arena-color-warning-bright": ARENA_THEME.colors.warningBright,
  "--arena-font-ui": ARENA_THEME.typography.domFontFamily,
} as const;

type ThemeStyleTarget = {
  style: {
    setProperty(name: string, value: string): void;
  };
};

export function applyArenaDomTheme(
  target: ThemeStyleTarget = document.documentElement,
): void {
  for (const [name, value] of Object.entries(ARENA_DOM_THEME_VARIABLES)) {
    target.style.setProperty(name, value);
  }
}
