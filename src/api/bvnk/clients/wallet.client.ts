import type { HttpClient, HttpResponse } from '../../../../core/api/http.client.js'
import type { Wallet } from '../models/wallet.model.js'

/** Client for `/api/wallet` endpoints. */
export class WalletClient {
  /** @param http - HTTP transport (auth strategy already attached). */
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /api/wallet` — lists account wallets.
   *
   * @param query - Optional pagination: `offset` (default 0) and `max_count` (default 10).
   * @returns Response with the wallet list.
   */
  async list(query?: { offset?: number; max_count?: number }): Promise<HttpResponse<Wallet[]>> {
    return this.http.get<Wallet[]>('/api/wallet', query ? { query } : undefined)
  }

  /**
   * `GET /api/wallet/{id}` — a single wallet.
   *
   * @param walletId - Numeric wallet id (account-specific — discover via {@link list}).
   * @returns Response with the wallet, or a 4xx error body for unknown ids.
   */
  async get(walletId: number): Promise<HttpResponse<Wallet>> {
    return this.http.get<Wallet>(`/api/wallet/${walletId}`)
  }
}
