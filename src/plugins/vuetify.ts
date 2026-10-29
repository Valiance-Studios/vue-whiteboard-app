import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import {createVuetify} from 'vuetify';

export default createVuetify({
  theme: {
    defaultTheme: 'whiteboard',
    themes: {
      whiteboard: {
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
    },
  },
});
