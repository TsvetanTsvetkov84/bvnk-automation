import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'
import type { AiClient } from '../ai.client.js'

export type Model = 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5' | string

export interface MessageParams {
  model: Model
  max_tokens: number
  system: string
  thinking?: ThinkingConfigParam
  temperature?: number // when thinking is specified, this should be set to 1 or default
  messages: MessageParam[]
}

/** Thin wrapper around the Anthropic SDK that adds streaming and exponential-backoff retry for transient API errors (529, 503). */
export class AnthropicClient implements AiClient {
  private readonly client: Anthropic

  constructor(apiKey: string, retries: number) {
    this.client = new Anthropic({ apiKey: apiKey, maxRetries: retries })
  }

  /** Streams a message request and returns the extracted text response, retrying on transient API errors. */
  async sendMessage(
    messageParameters: MessageParams,
    numberOfRetries: number = 3
  ): Promise<string> {
    const response = await this.retry(async () => {
      const stream = this.client.messages.stream(messageParameters)
      return stream.finalMessage()
    }, numberOfRetries)

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')

    if (!textBlock) throw new Error('AI provider returned no text block')

    return textBlock.text
  }

  /** Retries {@link fn} with exponential backoff when the API returns 529 (overloaded) or 503 (unavailable). */
  private async retry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (err) {
        const isRetryable =
          err instanceof Anthropic.APIError &&
          (err.status === 529 || err.status === 503 || err.status === undefined)
        if (!isRetryable || attempt === maxAttempts) throw err
        const delay = baseDelayMs * 2 ** (attempt - 1)
        console.warn(
          `AI Anthropic attempt ${attempt}/${maxAttempts} failed (overloaded), retrying in ${delay}ms...`
        )
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw new Error('AI Anthropic Unreachable')
  }
}
