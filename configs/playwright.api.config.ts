import { defineConfig } from '@playwright/test'
import { baseConfig } from './base.config.js'

/**
 * Playwright configuration for the BVNK API test suite.
 *
 * API tests are pure HTTP — no browser is launched.
 */
export default defineConfig({
  ...baseConfig,
  testDir: '../tests/api',
  fullyParallel: true,
  // eslint-disable-next-line no-restricted-properties -- CI flag read at config load, before getConfig() is available
  retries: process.env['CI'] ? 1 : 0,
})
