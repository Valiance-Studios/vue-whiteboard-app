import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import {createVuetify} from 'vuetify';
import {loadThemeChoice} from '@/theme/themePreference';

export default createVuetify({
  theme: {
    // Decided before the first render, so a saved dark theme never flashes light.
    defaultTheme: loadThemeChoice(localStorage) ?? 'system',
    themes: {
      light: {
        dark: false,
        colors: {
          // Marker blue, the same ink the boards are written in.
          'primary': '#1f3b73',
          'background': '#f3f5f8',
          'surface': '#ffffff',
          'on-background': '#1c2330',
          'on-surface': '#1c2330',
        },
      },
      // The boards themselves stay white: they are whiteboards, and the marker inks are chosen for white.
      dark: {
        dark: true,
        colors: {
          // Marker blue lightened to read on dark surfaces, with dark text on it.
          'primary': '#9bb7ee',
          'on-primary': '#0d1b33',
          'background': '#11151c',
          'surface': '#1b212b',
          'on-background': '#e4e8ef',
          'on-surface': '#e4e8ef',
        },
      },
    },
  },
});
