# AI-Assisted Failure Review

## Overview

When a Playwright test fails, the framework automatically collects failure context, sends it to an AI provider for analysis, and outputs the result as an Allure attachment and a Postgres record — without any manual intervention.

The feature is transparent to test authors: it hooks into the existing `afterEach` fixture and only activates on failure.

---

## Flow

```
Test completes
  └── afterEach hook (api.fixture.ts)
        ├── buildTestResult        → assembles result from testInfo + annotations
        ├── reportTestResult       → Allure attachment (always, local + CI)
        │
        ├── [local] return early
        │
        └── [CI only]
              ├── repo.insert      → persist test result to Postgres
              └── [non-passing]
                    └── runAiFailureAnalysis (non-blocking, try/catch)
                          ├── collectFailure    → gathers context from testInfo + trace.zip
                          ├── analyzeFailure    → AI call via injected AiClient
                          ├── Allure attachment → AI analysis JSON
                          └── repo.updateAiFields → persist AI fields to Postgres
```

---

## Architecture

### Provider abstraction

```
core/
  reporting/
    failure-collector/
      failure-collector.ts                 ← extracts context from testInfo + trace.zip
      trace-parser.ts                      ← opens trace.zip, delegates to extractors
      extractors.ts                        ← console logs, network errors, failed actions, screenshots
  ai/
    ai.client.ts                             ← AiClient interface (provider-agnostic)
    clients/
      antropic.client.ts                     ← AnthropicClient implements AiClient
    automatic-failure-review/
      failure-analyzer.ts                    ← orchestrates analysis (accepts AiClient)
      parse-analysis.ts                      ← Zod schema + JSON parsing
      prompt-builder.ts                      ← system prompt + user prompt assembly
```

The failure collector lives under `core/reporting/` — it has no AI dependency and extracts data that can be consumed by any reporting mechanism (AI analysis, logging, notifications).

The `AiClient` interface decouples the analysis logic from any specific provider SDK. `AnthropicClient` implements it, handling streaming, retry, and text-block extraction internally.

The content builder (`buildFailureAnalysisContent` in `failure-analyzer.ts`) and `MessageParams` are still Anthropic-specific — this is intentional: abstracting the prompt format behind a generic `PromptBuilder` interface adds complexity with no benefit while there is only one provider. When a second provider is needed, extract the content builder into a provider-specific implementation behind a shared interface.

---

## Modules

### `core/ai/ai.client.ts`

Provider-agnostic AI client contract.

```ts
interface AiClient {
  sendMessage(params: unknown, numberOfRetries?: number): Promise<string>
}
```

### `core/ai/clients/antropic.client.ts`

Thin wrapper around the Anthropic SDK that adds streaming and exponential-backoff retry for transient API errors (529, 503). Implements `AiClient`.

```ts
class AnthropicClient implements AiClient {
  sendMessage(messageParameters: MessageParams): Promise<string>
}
```

Text-block extraction from the API response is handled internally — callers receive a plain string.

### `core/reporting/failure-collector/failure-collector.ts`

Extracts failure context from Playwright's `TestInfo` object and the attached `trace.zip`.

```ts
collectFailure(testInfo: TestInfo): FailureContext
```

Synchronous. Degrades gracefully — if no trace attachment is found, or if zip reading fails, all trace-derived fields return empty and `traceAvailable` is set to `false`.

#### `FailureContext` type

| Field                  | Type                  | Source                                                                  |
| ---------------------- | --------------------- | ----------------------------------------------------------------------- |
| `testName`             | `string`              | `testInfo.title`                                                        |
| `errors`               | `string[]`            | `testInfo.errors[].message`                                             |
| `stackTraces`          | `string[]`            | `testInfo.errors[].stack`                                               |
| `consoleLogs`          | `string[]`            | `log` events in `0-trace.trace` (last 50)                               |
| `networkErrors`        | `string[]`            | `resource-snapshot` events in `0-trace.network` with HTTP status ≥ 400  |
| `failedActions`        | `FailedAction[]`      | `before`/`after` event pairs where assertion failed or error was thrown |
| `lastScreenshotBase64` | `string \| undefined` | Last `screencast-frame` by timestamp from `resources/` inside the zip   |
| `traceAvailable`       | `boolean`             | `true` if `trace.zip` was found and read successfully                   |

#### `FailedAction` type

```ts
type FailedAction = {
  method: string // e.g. "Locator.waitFor", "Frame.goto"
  params: Record<string, unknown> // the call arguments
  error?: string // error message if the call threw
}
```

A `FailedAction` is produced for every `before`/`after` event pair where:

- `after.error` is present (the call threw an exception), or
- `after.result.matches === false` (an assertion evaluated to false)

### `core/reporting/failure-collector/trace-parser.ts`

Parses a Playwright trace zip and extracts failure context. Returns an empty context if no trace path is provided or parsing fails.

#### Trace zip structure

Playwright writes a `trace.zip` attachment on failure. The zip contains:

| File               | Content                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `0-trace.trace`    | Newline-delimited JSON — execution events (`log`, `before`, `after`, `screencast-frame`, etc.) |
| `0-trace.network`  | Newline-delimited JSON — all HTTP requests/responses (`resource-snapshot` events)              |
| `resources/*.jpeg` | Sequential page screenshots captured during the test                                           |

### `core/reporting/failure-collector/extractors.ts`

Individual extraction functions that operate on parsed trace events:

| Function                | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| `extractConsoleLogs`    | Returns the last 50 console log messages                                       |
| `extractNetworkErrors`  | Extracts HTTP requests with status ≥ 400                                       |
| `extractFailedActions`  | Correlates before/after events by callId to identify failed Playwright actions |
| `extractLastScreenshot` | Extracts the last screencast frame as base64, falls back to last JPEG resource |

### `core/ai/automatic-failure-review/failure-analyzer.ts`

Orchestrates the analysis: builds Anthropic-specific content blocks from a `FailureContext`, sends them via the injected `AiClient`, and validates the response against the Zod schema.

```ts
analyzeFailure(client: AiClient, failureContext: FailureContext): Promise<FailureAnalysis>
```

### `core/ai/automatic-failure-review/parse-analysis.ts`

Zod schema for validating the structured JSON response returned by the AI provider.

```ts
const AnalysisSchema = z.object({
  explanation: z.string(),
  classification: z.enum(['flaky', 'bug', 'env-issue', 'assertion', 'dont-know']),
  suggestedAction: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
})
```

| Field             | Description                         |
| ----------------- | ----------------------------------- |
| `explanation`     | Human-readable root cause summary   |
| `classification`  | Category of failure                 |
| `suggestedAction` | Concrete next step for the engineer |
| `confidence`      | AI confidence level in the analysis |

### `core/ai/automatic-failure-review/prompt-builder.ts`

Assembles the system prompt (instructs the AI to respond with structured JSON) and the user prompt (markdown sections from the `FailureContext`).

---

## Hook Integration

The `afterEach` hook in `api.fixture.ts` orchestrates post-test reporting. It delegates to three focused helpers:

| Helper                 | Responsibility                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `buildTestResult`      | Assembles a `TestResultInsert` from test metadata, annotations (jira, priority), and CI build context                  |
| `reportTestResult`     | Attaches the test result as a JSON Allure attachment                                                                   |
| `runAiFailureAnalysis` | Collects failure context, sends it to the AI provider, attaches analysis to Allure, and persists AI fields to Postgres |

```ts
page.afterEach(async ({ db, config }, testInfo) => {
  const repo = new TestResultsRepository(db)
  const testResult = buildTestResult(testInfo, config, buildId)

  // always attach result to Allure (local + CI)
  await reportTestResult(testResult)

  // local execution stops here — no DB writes or AI analysis
  if (!isExecutionInCI) return

  // CI: persist test result to Postgres
  await repo.insert(testResult)

  // CI: run AI failure analysis for non-passing tests
  if (testInfo.status !== 'passed') {
    const { ANTHROPIC_API_KEY } = getConfig(anthropicEnvSchema)
    const aiClient = new AnthropicClient(ANTHROPIC_API_KEY, 3)
    await runAiFailureAnalysis(aiClient, testInfo, repo, buildId)
  }
})
```

> `runAiFailureAnalysis` wraps its body in `try/catch` — an AI or network failure is logged but never propagates, so it cannot affect the test run exit code or block CI.

---

## Reporting

**Allure attachment** — JSON attached directly to the failed test.

**Postgres** — extends the `test_results` table with AI analysis fields:

| Column                | Type   | Description                                               |
| --------------------- | ------ | --------------------------------------------------------- |
| `ai_explanation`      | `TEXT` | Root cause explanation                                    |
| `ai_classification`   | `TEXT` | `flaky` / `bug` / `env-issue` / `assertion` / `dont-know` |
| `ai_suggested_action` | `TEXT` | Recommended fix                                           |
| `ai_confidence`       | `TEXT` | `high` / `medium` / `low`                                 |

Grafana dashboards are extended with new panels once the columns exist.

---

## CI Integration

### Environment Variable

Add `ANTHROPIC_API_KEY` as a GitHub Actions secret and expose it in the workflow's test step:

```yaml
- name: Run API tests
  run: yarn test:api
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

No other workflow changes are required — the hook runs transparently inside the existing test execution step. The feature is **strictly optional**: if the secret is absent, the analysis is skipped and the test run is unaffected.

---

## Dependencies

| Package             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `@anthropic-ai/sdk` | Claude API client                          |
| `zod`               | Structured output schema validation        |
| `allure-js-commons` | Attaching analysis to test report          |
| `adm-zip`           | Reading Playwright `trace.zip` attachments |

---

## Notes

- Analysis only runs on failed tests — no overhead on passing runs.
- The Playwright trace (`trace.zip`) is optional; analysis degrades gracefully if no trace attachment is found or if zip reading fails.
- `ANTHROPIC_API_KEY` must be present in the environment; if missing, the `getConfig` call throws and is caught by the `try/catch` wrapper.
- Cost: each analysis is a single Claude API call with streaming.
- The `AiClient` interface paves the way for swapping providers. But more de-coupling is needed in the prompt builder, should this ever be needed.
