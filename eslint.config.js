import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import preferArrow from 'eslint-plugin-prefer-arrow';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const layerZones = [
  {
    target: './src/config',
    from: ['lib', 'services', 'hooks', 'components', 'dev'].map(
      (dir) => `./src/${dir}`,
    ),
    message: 'config/ is a leaf: it cannot import from other layers.',
  },
  {
    target: './src/services',
    from: ['lib', 'hooks', 'components', 'dev'].map((dir) => `./src/${dir}`),
    message:
      'services/ is the data layer: it may only import config/ (and other services).',
  },
  {
    target: './src/lib',
    from: ['hooks', 'components', 'dev'].map((dir) => `./src/${dir}`),
    message:
      'lib/ is plain logic: it cannot import hooks, components or dev code.',
  },
  {
    target: './src/hooks',
    from: ['./src/components', './src/dev'],
    message: 'hooks/ cannot import components.',
  },
  {
    target: './src/dev',
    from: './src/components',
    message: 'dev/ cannot import components.',
  },
];

const devZones = [
  {
    target: './src',
    from: './src/dev',
    message: 'dev/ is mock tooling and must stay out of the production graph.',
  },
];

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
  // Source layout (docs/structure.md): imports only flow down the list
  // config -> services -> lib -> hooks -> components, and cross-folder imports
  // use the `@/` alias. Tests may cross layers.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: "Import across folders with '@/…' instead of '../'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/tests/**'],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: layerZones },
      ],
    },
  },
  // Production code must not reach into dev tooling. The one seam is the
  // gated dynamic import in services/ha/instance.ts.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/dev/**', 'src/**/*.test.{ts,tsx}', 'src/tests/**'],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: [...layerZones, ...devZones],
        },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off stylistic rules that conflict with Prettier.
  prettier,
]);
