import { test as base, expect } from '@playwright/test'
import { Pool } from 'pg'
import { getConfig } from '../../../core/config/config.js'
import {
  type ApiTestEnvConfig,
  apiTestEnvSchema,
  dbEnvSchema,
} from '../../../core/config/env-schema.js'
import type { DatabaseClient } from '../../../core/db/db.client.js'
import { PostgresClient } from '../../../core/db/postgres/postgres.client.js'
import { TestResultsRepository } from '../../../core/db/repositories/test-results.repository.js'
import {
  buildTestResult,
  reportTestResult,
  runAiFailureAnalysis,
} from '../../../core/reporting/test-results/test-result-reporter.js'
import { type BvnkApi, createBvnkApi } from '../bvnk/bvnk-api.js'

type WorkerFixtures = {
  config: ApiTestEnvConfig
  /** Fresh simulated account (via /init) shared by all tests of one worker. */
  account: { token: string; expiry: number }
  /** Optional Postgres client for test-result persistence; null when DB env is not configured. */
  db: DatabaseClient | null
}

type TestFixtures = {
  /** Authenticated BVNK API clients bound to this worker's account. */
  bvnkApi: BvnkApi
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  config: [
    async ({}, use) => {
      await use(getConfig(apiTestEnvSchema))
    },
    { scope: 'worker' },
  ],

  account: [
    async ({ config }, use) => {
      // Each worker gets its own simulated account → full test isolation, parallel-safe.
      const anonymousApi = createBvnkApi(config.BVNK_BASE_URL)
      const res = await anonymousApi.auth.init()
      if (res.status !== 200) {
        throw new Error(`GET /init failed with HTTP ${res.status}: ${JSON.stringify(res.data)}`)
      }
      await use({ token: res.data.access_token, expiry: res.data.expiry })
    },
    { scope: 'worker' },
  ],

  db: [
    async ({}, use) => {
      const dbEnv = dbEnvSchema.safeParse(
        // eslint-disable-next-line no-restricted-properties
        process.env
      )
      if (!dbEnv.success) {
        console.warn(
          '⚠️ Test-result persistence disabled: DB_* env vars not configured (set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME to enable)'
        )
        await use(null)
        return
      }
      const pool = new Pool({
        host: dbEnv.data.DB_HOST,
        port: dbEnv.data.DB_PORT,
        user: dbEnv.data.DB_USER,
        password: dbEnv.data.DB_PASSWORD,
        database: dbEnv.data.DB_NAME,
      })
      const client = new PostgresClient(pool)
      await use(client)
      await client.close()
    },
    { scope: 'worker' },
  ],

  bvnkApi: async ({ config, account }, use) => {
    await use(createBvnkApi(config.BVNK_BASE_URL, () => account.token))
  },
})

/**
 * Post-test hook: attaches the result to Allure always; when configured, additionally persists
 * to Postgres (feeds the Grafana flakiness dashboards) and runs AI failure analysis.
 * Both extras are optional and never affect the test outcome.
 */
test.afterEach(async ({ db, config }, testInfo) => {
  // eslint-disable-next-line no-restricted-properties
  const buildId = process.env['GITHUB_RUN_ID'] ?? process.env['BUILD_ID'] ?? 'local'

  const testResult = buildTestResult(testInfo, config.TARGET_ENV, buildId)
  await reportTestResult(testResult)

  if (db) {
    try {
      const repo = new TestResultsRepository(db)
      await repo.insert(testResult)

      if (testInfo.status !== 'passed') {
        await runAiFailureAnalysis(testInfo, repo, buildId)
      }
    } catch (err) {
      console.error('Test-result persistence failed (non-blocking):', err)
    }
  }
})

export { expect }
