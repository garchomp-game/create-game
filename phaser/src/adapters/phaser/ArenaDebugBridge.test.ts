import { describe, expect, it, vi } from "vitest";
import { ArenaDebugBridge, type ArenaDebugApi } from "./ArenaDebugBridge";

describe("ArenaDebugBridge", () => {
  it("installs and removes only the API instance it owns", () => {
    const target: { __ARENA_DEBUG__?: ArenaDebugApi } = {};
    const bridge = new ArenaDebugBridge(target);
    const api = createApi();

    bridge.install(api);
    expect(target.__ARENA_DEBUG__).toBe(api);

    const replacement = createApi();
    target.__ARENA_DEBUG__ = replacement;
    bridge.uninstall();
    expect(target.__ARENA_DEBUG__).toBe(replacement);
  });

  it("removes the installed API when it is still active", () => {
    const target: { __ARENA_DEBUG__?: ArenaDebugApi } = {};
    const bridge = new ArenaDebugBridge(target);

    bridge.install(createApi());
    bridge.uninstall();

    expect(target.__ARENA_DEBUG__).toBeUndefined();
  });
});

function createApi(): ArenaDebugApi {
  return {
    getSnapshot: vi.fn(),
    getRunExport: vi.fn(),
    getRunExportJson: vi.fn(),
    getRunRecords: vi.fn(),
    getRunHistory: vi.fn(),
    getRunRankingRecords: vi.fn(),
    clearRunRecords: vi.fn(),
    getProfile: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    openMenu: vi.fn(),
    saveRunExport: vi.fn(),
    forceDamage: vi.fn(),
    restoreHealthForSoak: vi.fn(),
    forceGameOver: vi.fn(),
    grantXp: vi.fn(),
    forceUpgradeSelect: vi.fn(),
    forceExtraUpgradeSelect: vi.fn(),
    restart: vi.fn(),
    startAutoPilot: vi.fn(),
    setAutoPilotEnabled: vi.fn(),
    setPaused: vi.fn(),
    setElapsed: vi.fn(),
    setEnemyVisualFixture: vi.fn(),
    setObstacleFrictionFixture: vi.fn(),
    setHealPickupFixture: vi.fn(),
    setOffscreenEnemyIndicatorFixture: vi.fn(),
    loadCaptureScenario: vi.fn(),
    step: vi.fn(),
  } as unknown as ArenaDebugApi;
}
