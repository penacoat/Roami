// ESLint setup for the app. Run `npm run lint` (or `npx expo lint`) from mobile/.
//
// Style: Expo's defaults + TypeScript's recommended rules, with Prettier for
// formatting. Airbnb's React rules can be added later (see docs/coding-guidelines.md).
//
// The "layering" blocks at the bottom enforce where code goes
// (docs/where-code-goes.md):
//   - Only repositories import firebase/firestore.
//   - Only src/auth/ imports firebase/app and firebase/auth.
//   - Services go through repositories, never Firebase directly.
//   - src/logic/ is pure: no Firebase, no repositories, services, or api.
//   - Screens and components reach data only through callApi.
//   - Everywhere: imports from @roami/shared must be `import type`.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const tseslint = require('typescript-eslint');

const SHARED_TYPES_ONLY = {
  name: '@roami/shared',
  allowTypeImports: true,
  message:
    "Use `import type { ... } from '@roami/shared'`. A normal import crashes the app " +
    '(Unable to resolve module). See docs/shared-models.md.',
};

const FIREBASE = ['firebase', 'firebase/*', '@firebase/*'];

const ONLY_REPOSITORIES_USE_FIRESTORE = {
  group: FIREBASE,
  message:
    'Only src/repositories/ may import firebase/firestore, and only src/auth/ may import ' +
    'firebase/auth. See docs/where-code-goes.md.',
};

/** Builds the import-restriction rule for one layer. */
function restrictImports(patterns) {
  return {
    'no-restricted-imports': 'off',
    '@typescript-eslint/no-restricted-imports': ['error', { paths: [SHARED_TYPES_ONLY], patterns }],
  };
}

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'coverage/*', 'node_modules/*']),
  expoConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommended],
  },
  eslintPluginPrettierRecommended,
  {
    // Leftover console.log calls are easy to miss. Use console.warn or
    // console.error with an eslint-disable comment when output is intended.
    rules: { 'no-console': 'warn' },
  },

  // ---------- Layering ----------

  // Default for all app code (App.tsx, api/, dev/, and anything not listed below).
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: restrictImports([ONLY_REPOSITORIES_USE_FIRESTORE]),
  },

  // Repositories: the only code that touches Firestore.
  {
    files: ['src/repositories/**'],
    rules: restrictImports([
      {
        group: ['firebase/auth', '@firebase/auth'],
        message: 'Only src/auth/ may import firebase/auth.',
      },
    ]),
  },

  // Auth: the only code that touches firebase/auth (and creates the Firebase app).
  {
    files: ['src/auth/**'],
    rules: restrictImports([
      {
        group: ['firebase/firestore', '@firebase/firestore'],
        message: 'Only src/repositories/ may import firebase/firestore.',
      },
    ]),
  },

  // Services: check the request and call repositories, never Firebase directly.
  {
    files: ['src/services/**'],
    rules: restrictImports([
      {
        group: FIREBASE,
        message:
          'Services call repositories instead of Firebase. Move this Firestore code into ' +
          'src/repositories/.',
      },
    ]),
  },

  // Pure logic: plain data in, plain data out.
  {
    files: ['src/logic/**'],
    rules: restrictImports([
      {
        group: [
          ...FIREBASE,
          '**/repositories',
          '**/repositories/**',
          '**/services',
          '**/services/**',
        ],
        message: 'src/logic/ is pure: no Firebase, repositories, or services.',
      },
      {
        group: ['**/api', '**/api/**'],
        message:
          'src/logic/ is pure and does not throw ApiError. Return a result and let the service ' +
          'turn it into an ApiError.',
      },
    ]),
  },

  // Screens and components: data comes only from callApi.
  {
    files: ['src/screens/**', 'src/components/**', 'src/app/**'],
    rules: restrictImports([
      {
        group: [
          ...FIREBASE,
          '**/repositories',
          '**/repositories/**',
          '**/services',
          '**/services/**',
        ],
        message:
          "Screens get data only through callApi from 'src/api'. See docs/where-code-goes.md.",
      },
    ]),
  },

  // Type declarations may extend Firebase's own types.
  {
    files: ['**/*.d.ts'],
    rules: restrictImports([]),
  },

  // Tests may import and mock Firebase directly.
  {
    files: ['__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: restrictImports([]),
  },
]);
