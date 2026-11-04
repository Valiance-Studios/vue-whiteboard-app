import type {UserSettings} from '@/types/settings';

import {isThemeChoice} from '@/theme/themePreference';
import {isHexColor} from '@/utils/color';

/** Storage for one user's settings, scoped to that user so callers never pass an owner. */
export interface UserSettingsRepository {
  load(): Promise<UserSettings>;

  /** Saves the given fields, leaving the others as they are. */
  save(changes: UserSettings): Promise<void>;
}

/** Keeps only the valid settings from stored data, so a bad value reads as "not chosen" rather than failing. */
export function toUserSettings(stored: Record<string, unknown>): UserSettings {
  const {themeChoice, customMarkerColor} = stored;

  return {
    ...(isThemeChoice(themeChoice) && {themeChoice}),
    ...(isHexColor(customMarkerColor) && {customMarkerColor}),
  };
}
