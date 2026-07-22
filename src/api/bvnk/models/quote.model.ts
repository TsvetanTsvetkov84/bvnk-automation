/**
 * Quote lifecycle states.
 * Source: official BVNK OpenAPI export, `QuoteDto.quoteStatus` enum (all 8 values).
 * DIVERGENCE: `EXPIRED` is NOT in the official enum but is emitted by the simulator for
 * quotes past their acceptance window — simulator-observed extension.
 */
export const QUOTE_STATUS = {
  ESTIMATE: 'ESTIMATE',
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  PAYMENT_OUT_PROCESSED: 'PAYMENT_OUT_PROCESSED',
  PAYMENT_IN_FAILED: 'PAYMENT_IN_FAILED',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  PAYMENT_OUT_FAILED: 'PAYMENT_OUT_FAILED',
  REFUNDED: 'REFUNDED',
  /** Simulator-only — not part of the official enum. */
  EXPIRED: 'EXPIRED',
} as const

/**
 * Payment progress states.
 * Source: official BVNK OpenAPI export, `QuoteDto.paymentStatus` enum (all 7 values).
 * DIVERGENCE: `PROCESSING` and `EXPIRED` are NOT in the official enum but are emitted by the
 * simulator (during async settlement / after expiry) — simulator-observed extensions.
 */
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  REFUND_FAILED: 'REFUND_FAILED',
  /** Simulator-only — not part of the official enum. */
  PROCESSING: 'PROCESSING',
  /** Simulator-only — not part of the official enum. */
  EXPIRED: 'EXPIRED',
} as const

/** Body of `POST /api/v1/quote`. */
export type QuoteRequest = {
  readonly from: string
  readonly to: string
  readonly fromWallet: number
  readonly toWallet: number
  readonly amountIn?: number | string | null
  readonly amountOut?: number | string | null
  readonly useMaximum: boolean
  readonly useMinimum: boolean
  readonly reference: string
  readonly payInMethod: string
  readonly payOutMethod: string
}

/** Fee breakdown embedded in a quote. Percentages and values are decimal strings. */
export type QuoteFees = {
  readonly percentage: { readonly service: string; readonly processing: string }
  readonly value: { readonly service: string; readonly processing: string }
}

/**
 * Quote as returned by the quote endpoints.
 *
 * Per the OpenAPI contract: monetary values are decimal strings; dates are unix timestamps
 * in seconds. Per the task spec: the service fee is 0.01% and quotes expire 20s after creation.
 *
 * ASSUMPTION — researched, not specified anywhere: neither the task PDF, the simulator's
 * OpenAPI spec, nor BVNK's public API reference (docs.bvnk.com, incl. its OpenAPI export)
 * defines HOW the 0.01% fee is applied. We assume it is charged in the FROM currency on
 * `amountIn`, i.e. `amountOut = (amountIn − fee) × price` — corroborated (not proven) by the
 * official schema's `amountInGross`/`amountInNet` field pair. Tests assert this model; if BVNK
 * intends a different application (e.g. fee on the output leg), the assertions localize the
 * difference immediately.
 */
export type Quote = {
  readonly id: number
  readonly uuid: string
  readonly from: string
  readonly to: string
  readonly amountIn: string
  readonly amountDue: string
  readonly amountOut: string
  readonly price: string
  readonly netPrice: string
  readonly grossPrice: string
  readonly fee: string
  readonly processingFee: string
  readonly fees: QuoteFees
  readonly type: string
  readonly quoteStatus: string
  readonly paymentStatus: string
  readonly acceptanceExpiryDate: number
  readonly acceptanceDate: number | null
  readonly paymentExpiryDate: number
  readonly paymentReceiptDate: number | null
  readonly reference?: string
  readonly dateCreated: number
  readonly lastUpdated: number
}
