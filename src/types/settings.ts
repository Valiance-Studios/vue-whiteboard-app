import type {ThemeChoice} from '@/theme/themePreference';
import type {HexColor} from '@/utils/color';

/** One user's preferences. A missing field means they have not chosen one. */
export interface UserSettings {
  themeChoice?: ThemeChoice;
  customMarkerColor?: HexColor;
}
