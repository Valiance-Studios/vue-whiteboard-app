import type {UserSettings} from '@/types/settings';
import type {UserSettingsRepository} from './UserSettingsRepository';

import {loadThemeChoice, saveThemeChoice} from '@/theme/themePreference';
import {toUserSettings} from './UserSettingsRepository';

const CUSTOM_MARKER_COLOR_KEY = 'whiteboard.customMarkerColor';

/** Keeps settings in this browser, for anyone without a Google session. */
export class LocalStorageUserSettingsRepository implements UserSettingsRepository {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  // Async like the interface, so storage errors reject rather than throw.
  async load(): Promise<UserSettings> {
    return toUserSettings({
      themeChoice: loadThemeChoice(this.storage),
      customMarkerColor: this.storage.getItem(CUSTOM_MARKER_COLOR_KEY),
    });
  }

  async save({themeChoice, customMarkerColor}: UserSettings): Promise<void> {
    if (themeChoice) {
      saveThemeChoice(this.storage, themeChoice);
    }

    if (customMarkerColor) {
      this.storage.setItem(CUSTOM_MARKER_COLOR_KEY, customMarkerColor);
    }
  }
}
