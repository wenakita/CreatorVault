import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'fix_duplicates.js'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...(tsPlugin.configs.recommended?.rules ?? {}),
      ...(reactHooks.configs.recommended?.rules ?? {}),
      // This repo intentionally uses `any` in several integration points (RPC, SDKs, browser wallets).
      '@typescript-eslint/no-explicit-any': 'off',
      // Let TypeScript handle unused symbols for app code; avoid blocking CI on legacy/serverless helpers.
      '@typescript-eslint/no-unused-vars': 'off',
      // Existing code uses `@ts-ignore` in a few places where upstream types are incomplete.
      '@typescript-eslint/ban-ts-comment': 'off',
      // Avoid warnings (lint runs with --max-warnings 0).
      'react-refresh/only-export-components': 'off',
    },
  },
]


