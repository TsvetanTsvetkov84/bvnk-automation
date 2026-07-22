/** Provider-agnostic AI client contract. Implementations handle provider-specific param types and response extraction. */
export interface AiClient {
  /** Sends a message to the AI provider and returns the extracted text response. */
  sendMessage(params: unknown, numberOfRetries?: number): Promise<string>
}
