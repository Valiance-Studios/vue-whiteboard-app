/** A theme the visitor picked with the toggle. Without one, the app follows the system setting. */
export type ThemeChoice = 'light' | 'dark';

const THEME_KEY = 'whiteboard.theme';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark';
}

/** The visitor's saved choice, or `null` if they have not picked one (or it cannot be read). */
export function loadThemeChoice(storage: Storage): ThemeChoice | null {
  try {
    const choice = storage.getItem(THEME_KEY);

    return isThemeChoice(choice) ? choice : null;
  } catch {
    return null;
  }
}

export function saveThemeChoice(storage: Storage, choice: ThemeChoice): void {
  storage.setItem(THEME_KEY, choice);
}
