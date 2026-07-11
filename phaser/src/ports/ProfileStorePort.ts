import type {
  LocalProfile,
  ProfileSettings,
  ProfileSettingsUpdate,
} from "../domain/profile";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ProfileStorePort = {
  loadProfile(): LocalProfile;
  updateDisplayName(displayName: string | undefined): LocalProfile;
  loadSettings(): ProfileSettings;
  updateSettings(update: ProfileSettingsUpdate): ProfileSettings;
  resetSettings(): ProfileSettings;
  /** Replaces only the guest identity; settings and run records stay intact. */
  resetProfile(): LocalProfile;
};
