import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import {defineConfig} from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';

const stylisticOptions = {
  semi: true,
  quotes: 'single',
  braceStyle: '1tbs',
  arrowParens: true,
};

export default defineConfig([
  // Ignored paths
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // All source files (JS, TS, Vue)
  {
    files: ['**/*.{js,ts,vue}'],
    extends: [tseslint.configs.recommended],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      ...stylistic.configs.customize(stylisticOptions).rules,
      '@stylistic/object-curly-spacing': ['error', 'never'],
    },
  },

  // Vue single-file components
  {
    files: ['**/*.vue'],
    extends: [pluginVue.configs['flat/recommended']],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // Mirror the script-side stylistic rules inside template expressions.
      'vue/object-curly-spacing': ['error', 'never'],
      'vue/brace-style': ['error', '1tbs'],
    },
  },

  // Application TypeScript (browser)
  {
    files: ['src/**/*.ts', 'env.d.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Tooling config files (Node)
  {
    files: ['*.config.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Unit and rules tests (Vitest)
  {
    files: ['tests/unit/**/*.ts', 'tests/rules/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.node,
      },
    },
  },

  // E2E tests (Playwright, Node)
  {
    files: ['tests/e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]);
