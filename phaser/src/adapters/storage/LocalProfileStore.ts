import type { ZodType } from "zod";
import {
  createDefaultProfileSettings,
  localProfileSchema,
  PROFILE_SCHEMA_VERSION,
  PROFILE_SETTINGS_SCHEMA_VERSION,
  profileSettingsSchema,
} from "../../domain/profile";
import type {
  LocalProfile,
  ProfileSettings,
  ProfileSettingsUpdate,
} from "../../domain/profile";
import type { ProfileStorePort, StorageLike } from "../../ports/ProfileStorePort";

export const DEFAULT_PROFILE_STORAGE_KEY = "arena-core.profile.v1";
export const DEFAULT_PROFILE_SETTINGS_STORAGE_KEY = "arena-core.settings.v1";

export type LocalProfileStoreOptions = {
  generateUuid?: () => string;
  now?: () => Date;
  profileStorageKey?: string;
  settingsStorageKey?: string;
};

export class LocalProfileStore implements ProfileStorePort {
  private readonly generateUuid: () => string;
  private readonly now: () => Date;
  private readonly profileStorageKey: string;
  private readonly settingsStorageKey: string;

  constructor(
    private readonly storage: StorageLike,
    options: LocalProfileStoreOptions = {},
  ) {
    this.generateUuid = options.generateUuid ?? defaultGenerateUuid;
    this.now = options.now ?? defaultNow;
    this.profileStorageKey = options.profileStorageKey ?? DEFAULT_PROFILE_STORAGE_KEY;
    this.settingsStorageKey =
      options.settingsStorageKey ?? DEFAULT_PROFILE_SETTINGS_STORAGE_KEY;
  }

  loadProfile(): LocalProfile {
    const storedProfile = this.read(this.profileStorageKey, localProfileSchema);
    if (storedProfile) return storedProfile;

    const profile = this.createProfile();
    this.write(this.profileStorageKey, profile);
    return profile;
  }

  updateDisplayName(displayName: string | undefined): LocalProfile {
    const current = this.loadProfile();
    const updatedAt = this.now().toISOString();
    const { displayName: _currentDisplayName, ...profileWithoutDisplayName } = current;
    const profile = localProfileSchema.parse(
      displayName === undefined
        ? { ...profileWithoutDisplayName, updatedAt }
        : { ...profileWithoutDisplayName, displayName, updatedAt },
    );

    this.write(this.profileStorageKey, profile);
    return profile;
  }

  loadSettings(): ProfileSettings {
    const storedSettings = this.read(
      this.settingsStorageKey,
      profileSettingsSchema,
    );
    if (storedSettings) return storedSettings;

    return this.resetSettings();
  }

  updateSettings(update: ProfileSettingsUpdate): ProfileSettings {
    const settings = profileSettingsSchema.parse({
      ...this.loadSettings(),
      ...update,
      schemaVersion: PROFILE_SETTINGS_SCHEMA_VERSION,
    });

    this.write(this.settingsStorageKey, settings);
    return settings;
  }

  resetSettings(): ProfileSettings {
    const settings = createDefaultProfileSettings();
    this.write(this.settingsStorageKey, settings);
    return settings;
  }

  resetProfile(): LocalProfile {
    const profile = this.createProfile();
    this.write(this.profileStorageKey, profile);
    return profile;
  }

  private createProfile(): LocalProfile {
    const timestamp = this.now().toISOString();
    return localProfileSchema.parse({
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: this.generateUuid(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  private read<T>(key: string, schema: ZodType<T>): T | null {
    const serialized = this.storage.getItem(key);
    if (serialized === null) return null;

    try {
      const result = schema.safeParse(JSON.parse(serialized));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value));
  }
}

function defaultGenerateUuid(): string {
  return globalThis.crypto.randomUUID();
}

function defaultNow(): Date {
  return new Date();
}
