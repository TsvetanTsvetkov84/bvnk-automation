import 'dotenv/config'
import { defineConfig } from '@playwright/test'

/**
 * Playwright configuration for the BVNK API test suite.
 *
 * API tests are pure HTTP — no browser is launched.
 */
export default defineConfig({
  testDir: './tests/api',
  outputDir: './out/playwright-results',
  fullyParallel: true,
  // eslint-disable-next-line no-restricted-properties -- CI flag read at config load, before getConfig() is available
  retries: process.env['CI'] ? 1 : 0,
  // Cap CI workers: each is its own simulator account; the shared host rate-limits under load
  // eslint-disable-next-line no-restricted-properties
  ...(process.env['CI'] ? { workers: 4 } : {}),
  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        resultsDir: './out/allure-results',
        environmentInfo: {
          node_version: process.version,
        },
      },
    ],
  ],
})
