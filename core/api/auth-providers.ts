import { type AuthHeadersProvider } from './http.client.js'

/**
 * Bearer token auth: `Authorization: Bearer <token>`
 *
 * @param getToken - Supplier of the current token, sync or async. Called on every request, so it
 *   can return a rotated/refreshed token over time. Return `null` to skip auth for that request
 *   (no `Authorization` header is sent).
 * @returns An {@link AuthHeadersProvider} that resolves the token per request and emits the
 *   `Authorization: Bearer <token>` header, or `null` when no token is available.
 */
export function bearerTokenAuth(
  getToken: () => Promise<string | null> | string | null
): AuthHeadersProvider {
  return async (): Promise<Readonly<Record<string, string>> | null> => {
    const token: string | null = await getToken()
    if (!token) return null
    return { Authorization: `Bearer ${token}` }
  }
}

/**
 * Basic auth: `Authorization: Basic <base64(user:pass)>`
 *
 * @param getCredentials - Supplier of the `{ user, pass }` pair, sync or async. Called on every
 *   request. Return `null` to skip auth for that request (no `Authorization` header is sent).
 * @returns An {@link AuthHeadersProvider} that base64-encodes `user:pass` per request and emits
 *   the `Authorization: Basic <encoded>` header, or `null` when no credentials are available.
 */
export function basicAuth(
  getCredentials: () =>
    | Promise<{ user: string; pass: string } | null>
    | { user: string; pass: string }
    | null
): AuthHeadersProvider {
  return async (): Promise<Readonly<Record<string, string>> | null> => {
    const creds: { user: string; pass: string } | null = await getCredentials()
    if (!creds) return null
    const encoded: string = Buffer.from(`${creds.user}:${creds.pass}`).toString('base64')
    return { Authorization: `Basic ${encoded}` }
  }
}

/**
 * Static header auth: sends a fixed header name/value pair.
 * Useful for API keys, custom tokens, etc.
 *
 * @param headerName - Name of the header to send (e.g. `X-Api-Key`).
 * @param getToken - Supplier of the header value, sync or async. Called on every request. Return
 *   `null` to skip auth for that request (the header is not sent).
 * @returns An {@link AuthHeadersProvider} that emits `{ [headerName]: value }` per request, or
 *   `null` when no value is available.
 */
export function staticHeaderAuth(
  headerName: string,
  getToken: () => Promise<string | null> | string | null
): AuthHeadersProvider {
  return async (): Promise<Readonly<Record<string, string>> | null> => {
    const value: string | null = await getToken()
    if (!value) return null
    return { [headerName]: value }
  }
}
