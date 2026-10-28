import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

// Security rules tests run in Node against the Firestore emulator (see `npm run test:rules`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.spec.ts'],
    root: fileURLToPath(new URL('./', import.meta.url)),
    fileParallelism: false,
  },
});
