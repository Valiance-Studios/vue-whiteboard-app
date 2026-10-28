import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  plugins: [vue(), vuetify({autoImport: true})],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // Auto-imported Vuetify components are discovered lazily as pages load; pre-bundling them
    // makes Vite re-optimize and reload the page mid-session whenever a new one appears.
    exclude: ['vuetify'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
