import type { TestInfo } from '@playwright/test'
import { extractTraceFailureContext, type TraceFailureContext } from './trace-parser.js'

/** Aggregated failure context passed to the AI client for analysis. Combines test errors with trace-extracted data (actions, logs, screenshots). */
export type FailureContext = TraceFailureContext & {
  readonly testName: string
  readonly errors: readonly string[]
  readonly stackTraces: readonly string[]
}

/** Extracts error messages, stack traces, and trace data from a failed Playwright test into a unified {@link FailureContext}. */
export function collectFailure(testInfo: TestInfo): FailureContext {
  const errors: string[] = []
  const stackTraces: string[] = []

  for (const error of testInfo.errors) {
    if (error.message) errors.push(error.message)
    if (error.stack) stackTraces.push(error.stack)
  }

  const traceAttachment = testInfo.attachments.find(
    (a) => a.name === 'trace' && a.path?.endsWith('.zip')
  )

  const tracesFailureContext = extractTraceFailureContext(traceAttachment?.path)

  return {
    ...tracesFailureContext,
    testName: testInfo.title,
    errors,
    stackTraces,
  }
}
