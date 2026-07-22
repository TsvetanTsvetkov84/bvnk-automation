import { z } from 'zod'

/** Zod schema for validating the structured JSON response returned by the AI provider. */
export const AnalysisSchema = z.object({
  explanation: z.string(),
  classification: z.enum(['flaky', 'bug', 'env-issue', 'assertion', 'dont-know']),
  suggestedAction: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export type FailureAnalysis = z.infer<typeof AnalysisSchema>

/** Parses and validates the AI provider's raw text response into a typed {@link FailureAnalysis}. Throws on invalid JSON or schema mismatch. */
export function parseAnalysis(text: string): FailureAnalysis {
  const raw: unknown = JSON.parse(text.trim())
  return AnalysisSchema.parse(raw)
}
