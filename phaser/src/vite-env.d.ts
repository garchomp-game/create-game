/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_RULESET_VERSION: string;
  readonly VITE_GIT_COMMIT: string;
  readonly VITE_ARENA_FIXED_SEED?: string;
  readonly VITE_ARENA_RUN_ORIGIN?: string;
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
