import { defineConfig } from '@playwright/test'

export const baseConfig = defineConfig({
  testDir: '../tests',
  outputDir: './out/playwright-results',
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
