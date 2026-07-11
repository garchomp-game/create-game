import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROFILE_SETTINGS,
  PROFILE_SCHEMA_VERSION,
} from "../../domain/profile";
import type { ProfileSettingsUpdate } from "../../domain/profile";
import type { StorageLike } from "../../ports/ProfileStorePort";
import {
  DEFAULT_PROFILE_SETTINGS_STORAGE_KEY,
  DEFAULT_PROFILE_STORAGE_KEY,
  LocalProfileStore,
} from "./LocalProfileStore";

const PROFILE_ID_1 = "00000000-0000-4000-8000-000000000001";
const PROFILE_ID_2 = "00000000-0000-4000-8000-000000000002";
const CREATED_AT = "2026-07-10T01:00:00.000Z";
const UPDATED_AT = "2026-07-10T02:00:00.000Z";
const RESET_AT = "2026-07-10T03:00:00.000Z";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("LocalProfileStore", () => {
  it("creates and persists a guest profile and default settings on first load", () => {
    const storage = new MemoryStorage();
    const generateUuid = vi.fn(() => PROFILE_ID_1);
    const now = vi.fn(() => new Date(CREATED_AT));
    const store = new LocalProfileStore(storage, { generateUuid, now });

    const profile = store.loadProfile();
    const settings = store.loadSettings();

    expect(profile).toEqual({
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: PROFILE_ID_1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    expect(settings).toEqual(DEFAULT_PROFILE_SETTINGS);
    expect(JSON.parse(storage.getItem(DEFAULT_PROFILE_STORAGE_KEY)!)).toEqual(profile);
    expect(
      JSON.parse(storage.getItem(DEFAULT_PROFILE_SETTINGS_STORAGE_KEY)!),
    ).toEqual(settings);
    expect(generateUuid).toHaveBeenCalledOnce();
    expect(now).toHaveBeenCalledOnce();
  });

  it("keeps the guest id and optional display name across store instances", () => {
    const storage = new MemoryStorage();
    const generateUuid = vi.fn(() => PROFILE_ID_1);
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date(CREATED_AT))
      .mockReturnValueOnce(new Date(UPDATED_AT));
    const firstStore = new LocalProfileStore(storage, { generateUuid, now });

    firstStore.loadProfile();
    const namedProfile = firstStore.updateDisplayName("Pilot");

    const unusedUuidGenerator = vi.fn(() => PROFILE_ID_2);
    const unusedClock = vi.fn(() => new Date(RESET_AT));
    const reloadedStore = new LocalProfileStore(storage, {
      generateUuid: unusedUuidGenerator,
      now: unusedClock,
    });

    expect(reloadedStore.loadProfile()).toEqual(namedProfile);
    expect(namedProfile).toMatchObject({
      id: PROFILE_ID_1,
      displayName: "Pilot",
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(generateUuid).toHaveBeenCalledOnce();
    expect(unusedUuidGenerator).not.toHaveBeenCalled();
    expect(unusedClock).not.toHaveBeenCalled();
  });

  it("replaces a corrupted profile with a new guest and keeps valid settings", () => {
    const storage = new MemoryStorage();
    const customSettings = {
      ...DEFAULT_PROFILE_SETTINGS,
      bgmVolume: 0.25,
      shakeIntensity: 0,
    };
    storage.setItem(DEFAULT_PROFILE_STORAGE_KEY, "{not-json");
    storage.setItem(
      DEFAULT_PROFILE_SETTINGS_STORAGE_KEY,
      JSON.stringify(customSettings),
    );
    const store = new LocalProfileStore(storage, {
      generateUuid: () => PROFILE_ID_2,
      now: () => new Date(RESET_AT),
    });

    const recoveredProfile = store.loadProfile();

    expect(recoveredProfile).toEqual({
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: PROFILE_ID_2,
      createdAt: RESET_AT,
      updatedAt: RESET_AT,
    });
    expect(JSON.parse(storage.getItem(DEFAULT_PROFILE_STORAGE_KEY)!)).toEqual(
      recoveredProfile,
    );
    expect(store.loadSettings()).toEqual(customSettings);
  });

  it("recovers corrupted settings without replacing the profile", () => {
    const storage = new MemoryStorage();
    const generateUuid = vi.fn(() => PROFILE_ID_1);
    const store = new LocalProfileStore(storage, {
      generateUuid,
      now: () => new Date(CREATED_AT),
    });
    const profile = store.loadProfile();
    storage.setItem(
      DEFAULT_PROFILE_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_PROFILE_SETTINGS, flashIntensity: 2 }),
    );

    expect(store.loadSettings()).toEqual(DEFAULT_PROFILE_SETTINGS);
    expect(store.loadProfile()).toEqual(profile);
    expect(generateUuid).toHaveBeenCalledOnce();
  });

  it("updates settings and reloads them independently from the profile", () => {
    const storage = new MemoryStorage();
    const generateUuid = vi.fn(() => PROFILE_ID_1);
    const store = new LocalProfileStore(storage, {
      generateUuid,
      now: () => new Date(CREATED_AT),
    });
    const profile = store.loadProfile();

    const settings = store.updateSettings({
      bgmVolume: 0,
      sfxVolume: 0.35,
      bgmMuted: true,
      sfxMuted: true,
      shakeIntensity: 0,
      flashIntensity: 0.5,
      autoFireEnabled: false,
    });
    const reloadedStore = new LocalProfileStore(storage, {
      generateUuid: () => PROFILE_ID_2,
      now: () => new Date(RESET_AT),
    });

    expect(reloadedStore.loadSettings()).toEqual(settings);
    expect(reloadedStore.loadProfile()).toEqual(profile);
    expect(settings).toMatchObject({
      bgmVolume: 0,
      sfxVolume: 0.35,
      shakeIntensity: 0,
      flashIntensity: 0.5,
      autoFireEnabled: false,
    });
    expect(generateUuid).toHaveBeenCalledOnce();
  });

  it("rejects settings values outside the inclusive zero-to-one range", () => {
    const storage = new MemoryStorage();
    const store = new LocalProfileStore(storage, {
      generateUuid: () => PROFILE_ID_1,
      now: () => new Date(CREATED_AT),
    });
    const invalidUpdates: ProfileSettingsUpdate[] = [
      { bgmVolume: -0.01 },
      { sfxVolume: 1.01 },
      { shakeIntensity: -0.01 },
      { flashIntensity: 1.01 },
    ];

    for (const update of invalidUpdates) {
      expect(() => store.updateSettings(update)).toThrow();
    }
    expect(store.loadSettings()).toEqual(DEFAULT_PROFILE_SETTINGS);
  });

  it("resets only settings while preserving the complete profile", () => {
    const storage = new MemoryStorage();
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date(CREATED_AT))
      .mockReturnValueOnce(new Date(UPDATED_AT));
    const store = new LocalProfileStore(storage, {
      generateUuid: () => PROFILE_ID_1,
      now,
    });
    store.loadProfile();
    const namedProfile = store.updateDisplayName("Pilot");
    store.updateSettings({ bgmVolume: 0.2, autoFireEnabled: false });

    expect(store.resetSettings()).toEqual(DEFAULT_PROFILE_SETTINGS);
    expect(store.loadSettings()).toEqual(DEFAULT_PROFILE_SETTINGS);
    expect(store.loadProfile()).toEqual(namedProfile);
  });

  it("resets only the profile with a new id and preserves settings", () => {
    const storage = new MemoryStorage();
    const generateUuid = vi
      .fn<() => string>()
      .mockReturnValueOnce(PROFILE_ID_1)
      .mockReturnValueOnce(PROFILE_ID_2);
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date(CREATED_AT))
      .mockReturnValueOnce(new Date(UPDATED_AT))
      .mockReturnValueOnce(new Date(RESET_AT));
    const store = new LocalProfileStore(storage, { generateUuid, now });
    store.loadProfile();
    store.updateDisplayName("Pilot");
    const settings = store.updateSettings({ sfxMuted: true, flashIntensity: 0 });

    const resetProfile = store.resetProfile();

    expect(resetProfile).toEqual({
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: PROFILE_ID_2,
      createdAt: RESET_AT,
      updatedAt: RESET_AT,
    });
    expect(store.loadProfile()).toEqual(resetProfile);
    expect(store.loadSettings()).toEqual(settings);
    expect(generateUuid).toHaveBeenCalledTimes(2);
  });
});
