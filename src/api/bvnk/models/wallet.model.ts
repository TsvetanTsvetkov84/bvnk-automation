/**
 * Currency descriptor embedded in a wallet.
 * Only the fields relevant for testing are typed; the API returns more.
 */
export type Currency = {
  readonly id: number
  readonly code: string
  readonly fiat: boolean
  readonly name: string
  readonly quantityPrecision: number
  readonly pricePrecision: number
}

/**
 * Wallet as returned by `GET /api/wallet` and `GET /api/wallet/{id}`.
 *
 * Monetary values are decimal strings (e.g. "3.70000") — never parse them as floats
 * for assertions without an explicit tolerance.
 */
export type Wallet = {
  readonly id: number
  readonly description: string
  readonly currency: Currency
  readonly balance: string
  readonly available: string
  readonly address: string
  readonly status: string
  readonly protocol: string
  readonly withdrawalFee: string
  readonly depositFee: string
  readonly supportsWithdrawals?: boolean
  readonly supportsDeposits?: boolean
}
