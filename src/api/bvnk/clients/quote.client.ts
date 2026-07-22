import type { HttpClient, HttpResponse } from '../../../../core/api/http.client.js'
import type { Quote, QuoteRequest } from '../models/quote.model.js'

/** Client for `/api/v1/quote` endpoints. */
export class QuoteClient {
  /** @param http - HTTP transport (auth strategy already attached). */
  constructor(private readonly http: HttpClient) {}

  /**
   * `POST /api/v1/quote` — creates a quote for a currency conversion/trade.
   *
   * @param request - Trade parameters (pair, wallets, amount, reference).
   * @returns Response with the created quote (201) in `PENDING` status, valid for 20s.
   */
  async create(request: QuoteRequest): Promise<HttpResponse<Quote>> {
    return this.http.post<Quote, QuoteRequest>('/api/v1/quote', request)
  }

  /**
   * `POST /api/v1/quote` with an arbitrary body — for negative tests.
   *
   * @param body - Any payload (invalid currencies, missing fields, malformed shapes).
   * @returns Response typed as `TResponse` (defaults to `unknown`) so error bodies can be asserted.
   */
  async createRaw<TBody, TResponse = unknown>(body: TBody): Promise<HttpResponse<TResponse>> {
    return this.http.post<TResponse, TBody>('/api/v1/quote', body)
  }

  /**
   * `GET /api/v1/quote` — lists the account's quotes.
   *
   * @returns Response with all quotes created by this account.
   */
  async list(): Promise<HttpResponse<Quote[]>> {
    return this.http.get<Quote[]>('/api/v1/quote')
  }

  /**
   * `GET /api/v1/quote/{uuid}` — a single quote.
   *
   * @param quoteUuid - Quote uuid from {@link create}.
   * @returns Response with the quote's current state.
   */
  async get(quoteUuid: string): Promise<HttpResponse<Quote>> {
    return this.http.get<Quote>(`/api/v1/quote/${quoteUuid}`)
  }

  /**
   * `PUT /api/v1/quote/accept/{uuid}` — accepts a pending quote, executing the trade.
   *
   * @param quoteUuid - Quote uuid; must be accepted within the 20s validity window.
   * @returns Response with the quote in `ACCEPTED` status (settlement completes asynchronously).
   */
  async accept(quoteUuid: string): Promise<HttpResponse<Quote>> {
    return this.http.put<Quote, undefined>(`/api/v1/quote/accept/${quoteUuid}`, undefined)
  }
}
