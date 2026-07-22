import type { TestInfo } from '@playwright/test'
import * as allure from 'allure-js-commons'
import type { AiClient } from '../../ai/ai.client.js'
import { analyzeFailure } from '../../ai/automatic-failure-review/failure-analyzer.js'
import { AnthropicClient } from '../../ai/clients/antropic.client.js'
import { anthropicEnvSchema } from '../../config/env-schema.js'
import type { TestResultsRepository } from '../../db/repositories/test-results.repository.js'
import type { TestResultInsert } from '../../db/repositories/test-results.repository.js'
import { collectFailure } from '../failure-collector/failure-collector.js'

/**
 * Assembles a {@link TestResultInsert} from test metadata, annotations (jira, priority), and build context.
 *
 * @param testInfo - Playwright test metadata (title, status, retry, duration, annotations).
 * @param targetEnv - Environment label persisted with the result (e.g. "LOCAL", "CI").
 * @param buildId - CI build/run identifier ("local" outside CI).
 * @returns The row ready for Allure attachment and DB insertion.
 */
export function buildTestResult(
  testInfo: TestInfo,
  targetEnv: string,
  buildId: string
): TestResultInsert {
  return {
    jiraId: testInfo.annotations.find((a) => a.type === 'jira')?.description ?? 'unknown',
    priority: testInfo.annotations.find((a) => a.type === 'priority')?.description ?? 'unknown',
    testName: testInfo.title,
    targetEnv,
    status: testInfo.status ?? 'unknown',
    retry: testInfo.retry,
    duration: testInfo.duration,
    buildId,
  }
}

/**
 * Attaches the test result as a JSON Allure attachment for the current test.
 *
 * @param testResult - Result assembled by {@link buildTestResult}.
 * @returns Resolves when the attachment is written.
 */
export async function reportTestResult(testResult: TestResultInsert): Promise<void> {
  await allure.attachment('Test Result', JSON.stringify(testResult, null, 2), 'application/json')
}

/**
 * Runs AI failure analysis when an ANTHROPIC_API_KEY is configured; warns and skips otherwise.
 * Non-blocking — errors are logged but never propagate.
 *
 * @param testInfo - Failed test's metadata; failure context is collected from it (incl. trace.zip).
 * @param repo - Repository used to persist the AI fields.
 * @param buildId - CI build/run identifier used to locate the result row.
 * @returns Resolves when analysis is attached and persisted (or skipped).
 */
export async function runAiFailureAnalysis(
  testInfo: TestInfo,
  repo: TestResultsRepository,
  buildId: string
): Promise<void> {
  const anthropicEnv = anthropicEnvSchema.safeParse(
    // eslint-disable-next-line no-restricted-properties
    process.env
  )
  if (!anthropicEnv.success) {
    console.warn('⚠️ AI failure analysis skipped: ANTHROPIC_API_KEY not configured')
    return
  }

  try {
    const client: AiClient = new AnthropicClient(anthropicEnv.data.ANTHROPIC_API_KEY, 3)
    const context = collectFailure(testInfo)
    const analysis = await analyzeFailure(client, context)

    await allure.attachment(
      'AI Failure Analysis',
      JSON.stringify(analysis, null, 2),
      'application/json'
    )
    await repo.updateAiFields(analysis, testInfo.title, buildId)
  } catch (err) {
    console.error('AI failure analysis failed (non-blocking):', err)
  }
}
