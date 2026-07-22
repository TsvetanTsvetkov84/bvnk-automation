/**
 * Global configuration constants that don't change across environments.
 */
export const GLOBAL_CONST = {
  BVNK: {
    /** Service fee applied to all conversions/trades (0.01%). */
    SERVICE_FEE_RATE: 0.0001,
    /** Quotes expire this many seconds after creation if not accepted. */
    QUOTE_EXPIRY_SECONDS: 20,
    REQUEST_TIMEOUT_MS: 30_000,
  },
} as const
