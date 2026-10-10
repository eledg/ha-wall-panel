import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import preferArrow from 'eslint-plugin-prefer-arrow';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'node_modules',
    'playwright-report',
    'test-results',
    '.lovable-design',
  ]),

  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    plugins: { 'react-hooks': reactHooks, 'prefer-arrow': preferArrow },
    languageOptions: { globals: globals.browser },
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: ['tsconfig.app.json', 'tsconfig.node.json'],
        },
      },
    },
    rules: {
      // Default-import + member access is the normal ESM-interop shape for these packages.
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',

      ...reactHooks.configs.recommended.rules,

      'sort-imports': [
        'error',
        { ignoreCase: true, ignoreDeclarationSort: true },
      ],
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['sibling', 'parent'],
            'index',
            'unknown',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      'prefer-arrow/prefer-arrow-functions': 'error',
      'arrow-body-style': ['error', 'as-needed'],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off stylistic rules that conflict with Prettier.
  prettier,
]);
