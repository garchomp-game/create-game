/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_RULESET_VERSION: string;
  readonly VITE_GIT_COMMIT: string;
  readonly VITE_ARENA_FIXED_SEED?: string;
  readonly VITE_ARENA_RUN_ORIGIN?: string;
  readonly VITE_ARENA_ENABLE_TEST_HOOKS?: string;
  readonly VITE_ARENA_AUTO_PILOT_PATROL_STRATEGY?: string;
  readonly VITE_ARENA_AUTO_PILOT_MEASURE_PERFORMANCE?: string;
  readonly VITE_ARENA_AUTO_PILOT_WEAPONS?: string;
  readonly VITE_PHASER_RENDERER?: "canvas" | "webgl";
  readonly VITE_PHASER_PRESERVE_DRAWING_BUFFER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import type { ArenaDebugApi } from "./adapters/phaser/ArenaDebugBridge";

declare global {
  interface Window {
    __ARENA_DEBUG__?: ArenaDebugApi;
  }
}
