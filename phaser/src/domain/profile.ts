import { z } from "zod";

export const PROFILE_SCHEMA_VERSION = 1 as const;
export const PROFILE_SETTINGS_SCHEMA_VERSION = 1 as const;

const unitIntervalSchema = z.number().finite().min(0).max(1);

export const localProfileSchema = z
  .object({
    schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
    id: z.string().uuid(),
    displayName: z.string().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type LocalProfile = z.infer<typeof localProfileSchema>;

export const profileSettingsSchema = z
  .object({
    schemaVersion: z.literal(PROFILE_SETTINGS_SCHEMA_VERSION),
    bgmVolume: unitIntervalSchema,
    sfxVolume: unitIntervalSchema,
    bgmMuted: z.boolean(),
    sfxMuted: z.boolean(),
    shakeIntensity: unitIntervalSchema,
    flashIntensity: unitIntervalSchema,
    autoFireEnabled: z.boolean(),
  })
  .strict();

export type ProfileSettings = z.infer<typeof profileSettingsSchema>;

export type ProfileSettingsUpdate = Partial<
  Omit<ProfileSettings, "schemaVersion">
>;

export const DEFAULT_PROFILE_SETTINGS: Readonly<ProfileSettings> = Object.freeze({
  schemaVersion: PROFILE_SETTINGS_SCHEMA_VERSION,
  bgmVolume: 1,
  sfxVolume: 1,
  bgmMuted: false,
  sfxMuted: false,
  shakeIntensity: 1,
  flashIntensity: 1,
  autoFireEnabled: true,
});

export function createDefaultProfileSettings(): ProfileSettings {
  return { ...DEFAULT_PROFILE_SETTINGS };
}
