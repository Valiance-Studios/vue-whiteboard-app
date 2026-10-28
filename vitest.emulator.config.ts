import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

// Security rules and repository integration tests run in Node against the Firestore emulator (see `npm run test:emulator`).
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.spec.ts', 'tests/integration/**/*.spec.ts'],
    root: fileURLToPath(new URL('./', import.meta.url)),
    // Suites share one emulator database and clear it between tests.
    fileParallelism: false,
  },
});
