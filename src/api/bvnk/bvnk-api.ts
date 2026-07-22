import { bearerTokenAuth } from '../../../core/api/auth-providers.js'
import { AxiosHttpClient } from '../../../core/api/axios-http.client.js'
import { GLOBAL_CONST } from '../../../core/config/constants.js'
import { AuthClient } from './clients/auth.client.js'
import { QuoteClient } from './clients/quote.client.js'
import { WalletClient } from './clients/wallet.client.js'

/** Aggregated, ready-to-use clients for the BVNK simulator API. */
export type BvnkApi = {
  readonly auth: AuthClient
  readonly wallets: WalletClient
  readonly quotes: QuoteClient
}

/**
 * Builds the BVNK API client set.
 *
 * @param baseUrl - Simulator base URL.
 * @param getToken - Bearer token supplier; return `null` to send unauthenticated requests
 *   (used by /init and by negative auth tests).
 * @returns Ready-to-use {@link BvnkApi} client set sharing one HTTP transport.
 */
export function createBvnkApi(
  baseUrl: string,
  getToken: () => string | null = () => null
): BvnkApi {
  const http = new AxiosHttpClient({
    baseUrl,
    defaultHeaders: { 'Content-Type': 'application/json' },
    defaultTimeoutMs: GLOBAL_CONST.BVNK.REQUEST_TIMEOUT_MS,
    authProvider: bearerTokenAuth(getToken),
  })

  return {
    auth: new AuthClient(http),
    wallets: new WalletClient(http),
    quotes: new QuoteClient(http),
  }
}
