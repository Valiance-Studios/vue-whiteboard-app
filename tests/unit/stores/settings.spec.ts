import type {UserSettingsRepository} from '@/repositories';
import type {SessionUser} from '@/types/session';
import type {UserSettings} from '@/types/settings';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {DEFAULT_CUSTOM_MARKER_COLOR} from '@/constants/markers';
import {createUserSettingsRepository} from '@/repositories';
import {useAuthStore} from '@/stores/auth';
import {useSettingsStore} from '@/stores/settings';
import {loadThemeChoice} from '@/theme/themePreference';

vi.mock('@/firebase', () => ({auth: {}, db: {}}));
vi.mock('@/repositories', () => ({createUserSettingsRepository: vi.fn()}));

const GOOGLE_USER: SessionUser = {uid: 'u1', kind: 'google', displayName: 'Ada', email: null, photoURL: null};

describe('settings store', () => {
  let repository: {load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    useAuthStore().user = GOOGLE_USER;

    repository = {load: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue(undefined)};
    vi.mocked(createUserSettingsRepository).mockReturnValue(repository as unknown as UserSettingsRepository);
  });

  describe('load', () => {
    it('takes the session\'s settings, and remembers the theme for the next page load', async () => {
      repository.load.mockResolvedValue({themeChoice: 'dark', customMarkerColor: '#123456'});
      const store = useSettingsStore();

      await store.load();

      expect(store.themeChoice).toBe('dark');
      expect(store.customMarkerColor).toBe('#123456');
      expect(loadThemeChoice(localStorage)).toBe('dark');
    });

    it('asks for the current session\'s repository, even with no session', async () => {
      useAuthStore().user = null;

      await useSettingsStore().load();

      expect(createUserSettingsRepository).toHaveBeenCalledWith(null);
    });

    it('keeps the current theme, and goes back to the default marker color, when the session has chosen neither', async () => {
      localStorage.setItem('whiteboard.theme', 'dark');
      const store = useSettingsStore();
      store.customMarkerColor = '#123456';

      await store.load();

      expect(store.themeChoice).toBe('dark');
      expect(store.customMarkerColor).toBe(DEFAULT_CUSTOM_MARKER_COLOR);
    });

    it('discards settings that arrive after the session changed', async () => {
      let finishLoad: (settings: UserSettings) => void = () => {};
      repository.load.mockReturnValue(new Promise((resolve) => {
        finishLoad = resolve;
      }));
      const store = useSettingsStore();

      const loading = store.load();
      useAuthStore().user = null;
      finishLoad({themeChoice: 'dark', customMarkerColor: '#123456'});
      await loading;

      expect(store.themeChoice).toBeNull();
      expect(store.customMarkerColor).toBe(DEFAULT_CUSTOM_MARKER_COLOR);
    });

    it('does not overwrite a choice made while loading', async () => {
      let finishLoad: (settings: UserSettings) => void = () => {};
      repository.load.mockReturnValue(new Promise((resolve) => {
        finishLoad = resolve;
      }));
      const store = useSettingsStore();

      const loading = store.load();
      await store.setThemeChoice('light');
      await store.setCustomMarkerColor('#abcdef');
      finishLoad({themeChoice: 'dark', customMarkerColor: '#123456'});
      await loading;

      expect(store.themeChoice).toBe('light');
      expect(store.customMarkerColor).toBe('#abcdef');
    });

    it('keeps the current settings when loading fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      repository.load.mockRejectedValue(new Error('offline'));
      const store = useSettingsStore();
      store.customMarkerColor = '#123456';

      await store.load();

      expect(store.customMarkerColor).toBe('#123456');
      warn.mockRestore();
    });
  });

  describe('saving', () => {
    it('saves the theme and remembers it in this browser', async () => {
      const store = useSettingsStore();

      await store.setThemeChoice('dark');

      expect(store.themeChoice).toBe('dark');
      expect(repository.save).toHaveBeenCalledWith({themeChoice: 'dark'});
      expect(loadThemeChoice(localStorage)).toBe('dark');
    });

    it('saves the marker color', async () => {
      const store = useSettingsStore();

      await store.setCustomMarkerColor('#123456');

      expect(store.customMarkerColor).toBe('#123456');
      expect(repository.save).toHaveBeenCalledWith({customMarkerColor: '#123456'});
    });

    it('keeps the choice for this visit when saving fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      repository.save.mockRejectedValue(new Error('offline'));
      const store = useSettingsStore();

      await expect(store.setCustomMarkerColor('#123456')).resolves.toBeUndefined();

      expect(store.customMarkerColor).toBe('#123456');
      warn.mockRestore();
    });
  });
});
