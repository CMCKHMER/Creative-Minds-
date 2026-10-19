import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The codebase legitimately uses `any` at third-party SDK seams
      // (Supabase edge functions, Firestore REST payloads); narrowing those
      // is a follow-up, not a CI blocker.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Test files construct partial DOM trees and mock shapes on purpose.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // React-compiler-era rules flag ~20 pre-existing patterns across the
      // component tree (setState-in-effect for auth-ready flags, components
      // created inside render in test-heavy pages). Downgraded to warnings
      // so adoption lands now; fix incrementally and re-enable as errors.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // Node-side scripts and tests use Node globals, not browser globals.
    files: ['src/tests/**/*.ts', '*.config.ts', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // fs/path-driven tests read the repo layout — console output is the
      // point when they fail.
      'no-console': 'off',
    },
  },
);
