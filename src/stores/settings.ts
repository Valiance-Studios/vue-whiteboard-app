import type {HexColor} from '@/utils/color';
import type {ThemeChoice} from '@/theme/themePreference';
import type {UserSettings} from '@/types/settings';

import {defineStore} from 'pinia';
import {DEFAULT_CUSTOM_MARKER_COLOR} from '@/constants/markers';
import {createUserSettingsRepository} from '@/repositories';
import {loadThemeChoice, saveThemeChoice} from '@/theme/themePreference';
import {useAuthStore} from './auth';

interface SettingsState {
  /** The picked theme, or `null` to follow the system setting. */
  themeChoice: ThemeChoice | null;
  customMarkerColor: HexColor;
}

/**
 * Whatever the session, this browser keeps the theme, since it is needed before the first render,
 * when nothing else is known yet.
 */
function rememberThemeChoice(choice: ThemeChoice): void {
  try {
    saveThemeChoice(localStorage, choice);
  } catch (error) {
    console.warn('Could not remember the theme in this browser', error);
  }
}

/** A failed save loses only a preference, which still applies for this visit, so it never interrupts the user. */
async function saveSettings(changes: UserSettings): Promise<void> {
  try {
    await createUserSettingsRepository(useAuthStore().user).save(changes);
  } catch (error) {
    console.warn('Could not save settings', error);
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    themeChoice: loadThemeChoice(localStorage),
    customMarkerColor: DEFAULT_CUSTOM_MARKER_COLOR,
  }),

  actions: {
    /**
     * Reads the current session's settings; call it whenever the session changes. A theme the session has
     * not chosen leaves the current one in place. A choice made while this was loading is newer, so it stays.
     */
    async load(): Promise<void> {
      const authStore = useAuthStore();
      const uid = authStore.user?.uid;
      const {themeChoice, customMarkerColor} = this.$state;

      try {
        const settings = await createUserSettingsRepository(authStore.user).load();

        if (authStore.user?.uid !== uid) {
          return;
        }

        if (settings.themeChoice && this.themeChoice === themeChoice) {
          this.themeChoice = settings.themeChoice;
          rememberThemeChoice(settings.themeChoice);
        }

        if (this.customMarkerColor === customMarkerColor) {
          this.customMarkerColor = settings.customMarkerColor ?? DEFAULT_CUSTOM_MARKER_COLOR;
        }
      } catch (error) {
        console.warn('Could not load settings', error);
      }
    },

    async setThemeChoice(choice: ThemeChoice): Promise<void> {
      this.themeChoice = choice;
      rememberThemeChoice(choice);
      await saveSettings({themeChoice: choice});
    },

    async setCustomMarkerColor(color: HexColor): Promise<void> {
      this.customMarkerColor = color;
      await saveSettings({customMarkerColor: color});
    },
  },
});
