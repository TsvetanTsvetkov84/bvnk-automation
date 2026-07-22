import { FlatCompat } from '@eslint/eslintrc'

import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importXPlugin from 'eslint-plugin-import-x'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

export default [
  // Replaces ignorePatterns
  {
    ignores: [
      'node_modules/**',
      'out/**',
      '**/dist/**',
      '**/.eslintrc.cjs',
      'eslint.config.js',
      'core/reporting/allure/open.js',
      '.idea',
    ],
  },

  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),

  // Base config for TS/JS (env + parserOptions)
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'import-x': importXPlugin,
    },
    rules: {
      // General Best Practices
      // 'no-console': 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // TypeScript-Specific Rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Avoid redundant await, but allow in try/catch blocks
      // async function getUser() {
      //   return await fetchUser() // BAD
      //   return fetchUser() // GOOD
      // }
      // async function getUser() {
      //   try {
      //     return fetchUser() // BAD
      //     return await fetchUser() // GOOD
      //   } catch (e) {
      //     logger.error(e)
      //   }
      // }
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // Optional - aligned with the AI coding guidelines
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/prefer-readonly': 'warn',

      // Import Rules (ESM / NodeNext: require .js for relative imports)
      'import-x/no-unresolved': 'error',
      'import-x/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'never',
          js: 'always',
          json: 'always',
        },
      ],

      // Style rules
      semi: ['error', 'never'],
      'eol-last': ['error', 'always'],

      // Playwright recommended to avoid mistakes:
      // WRONG:   page.click('button')
      // CORRECT: await page.click('button')
      '@typescript-eslint/no-floating-promises': 'error',

      // Forbid using env.vars directly for unified and centralized env.var management
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Use core/config/config -> getConfig() instead of process.env',
        },
      ],
    },
    settings: {
      // TypeScript resolver (supports TS path mapping, exports, etc.)
      'import-x/resolver': {
        typescript: {
          project: path.resolve(__dirname, './tsconfig.json'),
          alwaysTryTypes: true,
        },
        node: {
          extensions: ['.js', '.ts'],
        },
      },
    },
  },

  // Overrides for Playwright fixtures
  {
    files: ['**/fixtures/**/*.ts', '**/*fixture*.ts', '**/*setup*.ts'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },

  // Overrides for test files
  {
    files: ['**/*.spec.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]
