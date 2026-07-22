import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { FailureContext } from '../../reporting/failure-collector/failure-collector.js'
import type { AiClient } from '../ai.client.js'
import { type MessageParams } from '../clients/antropic.client.js'
import { type FailureAnalysis, parseAnalysis } from './parse-analysis.js'
import { buildPrompt, FAILURE_ANALYSIS_SYSTEM_PROMPT } from './prompt-builder.js'

/**
 * Sends a {@link FailureContext} to an AI provider for root-cause analysis and returns a validated {@link FailureAnalysis}.
 *
 * The AI client is injected via the provider-agnostic {@link AiClient} interface, keeping this function
 * decoupled from any specific SDK. The content builder (`buildFailureAnalysisContent`) and message
 * params (`MessageParams`) are still Anthropic-specific — this is intentional: abstracting the prompt
 * format behind a generic `PromptBuilder` interface adds complexity with no benefit while there is only
 * one provider. When a second provider is needed, extract the content builder into a provider-specific
 * implementation behind a shared interface.
 *
 * @param client - AI provider used for the analysis. Owns transport concerns (streaming, retries,
 *   text-block extraction); this function only supplies the message payload.
 * @param failureContext - Failure data collected from Playwright's `TestInfo` and `trace.zip`
 *   (errors, stack traces, console logs, network errors, failed actions, optional last screenshot).
 *   The screenshot, when present, is attached to the prompt as an image block.
 * @returns The AI's analysis parsed and validated against the {@link FailureAnalysis} Zod schema
 *   (explanation, classification, suggested action, confidence).
 * @throws If the provider call ultimately fails after retries, or if the response does not conform
 *   to the expected JSON schema (`parseAnalysis` throws on invalid output).
 */
export async function analyzeFailure(
  client: AiClient,
  failureContext: FailureContext
): Promise<FailureAnalysis> {
  const failureAnalysisContent = buildFailureAnalysisContent(failureContext)

  const messageParams: MessageParams = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: FAILURE_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: failureAnalysisContent }],
  }

  const response = await client.sendMessage(messageParams)

  return parseAnalysis(response)
}

function buildFailureAnalysisContent(context: FailureContext): ContentBlockParam[] {
  const content: ContentBlockParam[] = [{ type: 'text', text: buildPrompt(context) }]

  if (context.lastScreenshotBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: context.lastScreenshotBase64,
      },
    })
    content.push({
      type: 'text',
      text: 'The image above is a screenshot of the page at the moment of failure.',
    })
  }
  return content
}
