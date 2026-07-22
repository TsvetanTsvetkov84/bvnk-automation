import AdmZip from 'adm-zip'
import { readZip } from '../../utils/zip-util.js'
import {
  extractConsoleLogs,
  extractFailedActions,
  extractLastScreenshot,
  extractNetworkErrors,
  type FailedAction,
  type TraceEvent,
} from './extractors.js'

/** Failure-relevant data extracted from a Playwright trace zip (logs, network errors, actions, screenshot). */
export type TraceFailureContext = {
  readonly consoleLogs: readonly string[]
  readonly networkErrors: readonly string[]
  readonly failedActions: readonly FailedAction[]
  readonly lastScreenshotBase64: string | undefined
  readonly traceAvailable: boolean
}

// ─── Public "API" ───────────────────────────────────────────────────────────

const EMPTY_CONTEXT: TraceFailureContext = {
  consoleLogs: [],
  networkErrors: [],
  failedActions: [],
  lastScreenshotBase64: undefined,
  traceAvailable: false,
}

/** Parses a Playwright trace zip and extracts failure context. Returns an empty context if no trace path is provided or parsing fails. */
export function extractTraceFailureContext(tracePath: string | undefined): TraceFailureContext {
  if (!tracePath) return EMPTY_CONTEXT

  try {
    const zip = new AdmZip(tracePath)
    const traceEvents = readZip<TraceEvent>(zip, (name) => name.endsWith('.trace'))
    const networkEvents = readZip<TraceEvent>(zip, (name) => name.endsWith('.network'))

    return {
      consoleLogs: extractConsoleLogs(traceEvents),
      networkErrors: extractNetworkErrors(networkEvents),
      failedActions: extractFailedActions(traceEvents),
      lastScreenshotBase64: extractLastScreenshot(zip, traceEvents),
      traceAvailable: true,
    }
  } catch (e) {
    console.error(`Error extracting trace failure information from trace: ${tracePath}`, e)
    return EMPTY_CONTEXT
  }
}
