import {beforeEach, describe, expect, it} from 'vitest';
import {LocalStorageUserSettingsRepository} from '@/repositories/LocalStorageUserSettingsRepository';

describe('LocalStorageUserSettingsRepository', () => {
  let repository: LocalStorageUserSettingsRepository;

  beforeEach(() => {
    localStorage.clear();
    repository = new LocalStorageUserSettingsRepository(localStorage);
  });

  it('has no settings until some are saved', async () => {
    await expect(repository.load()).resolves.toEqual({});
  });

  it('saves each field without touching the other', async () => {
    await repository.save({themeChoice: 'dark'});
    await repository.save({customMarkerColor: '#d81b60'});

    await expect(repository.load()).resolves.toEqual({themeChoice: 'dark', customMarkerColor: '#d81b60'});
  });

  it('keeps the theme where it is read before the first render', async () => {
    await repository.save({themeChoice: 'dark'});

    expect(localStorage.getItem('whiteboard.theme')).toBe('dark');
  });

  it('ignores invalid stored values', async () => {
    localStorage.setItem('whiteboard.theme', 'sepia');
    localStorage.setItem('whiteboard.customMarkerColor', 'pink');

    await expect(repository.load()).resolves.toEqual({});
  });
});
