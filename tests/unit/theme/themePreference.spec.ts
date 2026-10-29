import {beforeEach, describe, expect, it, vi} from 'vitest';
import {loadThemeChoice, saveThemeChoice} from '@/theme/themePreference';

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has no choice until one is saved', () => {
    expect(loadThemeChoice(localStorage)).toBeNull();
  });

  it.each(['light', 'dark'] as const)('remembers %s', (choice) => {
    saveThemeChoice(localStorage, choice);

    expect(loadThemeChoice(localStorage)).toBe(choice);
  });

  it('ignores an unknown saved value', () => {
    localStorage.setItem('whiteboard.theme', 'sepia');

    expect(loadThemeChoice(localStorage)).toBeNull();
  });

  it('has no choice when storage cannot be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    expect(loadThemeChoice(localStorage)).toBeNull();
    getItem.mockRestore();
  });
});
