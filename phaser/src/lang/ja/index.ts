import type { GameText } from "../types";
import { debugText } from "./debug";
import { hudText } from "./hud";
import { uiText } from "./ui";
import { upgradeText } from "./upgrades";

export const jaText: GameText = {
  ui: uiText,
  hud: hudText,
  upgrades: upgradeText,
  debug: debugText,
};
