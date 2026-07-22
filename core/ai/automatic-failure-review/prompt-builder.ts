import type { FailureContext } from '../../reporting/failure-collector/failure-collector.js'

/** System prompt instructing the AI to respond with a structured JSON failure analysis matching {@link AnalysisSchema}. */
export const FAILURE_ANALYSIS_SYSTEM_PROMPT = `You are an expert test automation engineer specialising in Playwright failures.
Analyse the provided failure context and respond with a JSON object — nothing else, no markdown fences.
The JSON must match this exact shape:
{
  "explanation":     "<concise root cause in plain English>",
  "classification":  "<flaky | bug | env-issue | assertion | dont-know>",
  "suggestedAction": "<specific actionable fix>",
  "confidence":      "<high | medium | low>"
}

Classification guide:
- flaky       → non-deterministic failure, likely timing or race condition
- bug         → application code is broken
- env-issue   → infrastructure or environment problem (network, DB, config)
- assertion   → test assertion is wrong or selector has changed
- dont-know   → in case you cannot determine the problem`

/**
 * Assembles the user prompt from a {@link FailureContext}, combining test name, errors, stack
 * traces, failed actions, network errors, and console logs into markdown sections.
 *
 * @param ctx - Failure data collected by the failure collector. Only non-empty fields become
 *   sections: `testName` is always included; `errors`, `stackTraces`, `failedActions`,
 *   `networkErrors`, and `consoleLogs` are skipped when empty; when `traceAvailable` is `false`,
 * @returns A markdown string with one `##` section per populated field, ready to be used as the
 *   text block of the user message.
 */
export function buildPrompt(ctx: FailureContext): string {
  const sections: string[] = [`## Failed test\n${ctx.testName}`]

  if (ctx.errors.length > 0) {
    sections.push(`## Errors\n${ctx.errors.join('\n\n')}`)
  }

  if (ctx.stackTraces.length > 0) {
    sections.push(`## Stack traces\n${ctx.stackTraces.join('\n\n')}`)
  }

  if (ctx.failedActions.length > 0) {
    const actions = ctx.failedActions
      .map((a) => `- ${a.method}(${JSON.stringify(a.params)})${a.error ? ` → ${a.error}` : ''}`)
      .join('\n')
    sections.push(`## Failed Playwright actions\n${actions}`)
  }

  if (ctx.networkErrors.length > 0) {
    sections.push(`## Network errors\n${ctx.networkErrors.join('\n')}`)
  }

  if (ctx.consoleLogs.length > 0) {
    sections.push(`## Console logs (last ${ctx.consoleLogs.length})\n${ctx.consoleLogs.join('\n')}`)
  }

  if (!ctx.traceAvailable) {
    sections.push('## Note\nNo Playwright trace was available for this failure.')
  }

  return sections.join('\n\n')
}
