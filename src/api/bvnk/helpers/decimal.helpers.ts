/**
 * Helpers for asserting on the API's decimal-string monetary values without
 * accumulating floating point error.
 */

/**
 * Parses an API decimal string into a number.
 *
 * @param decimalString - Decimal string as returned by the API (e.g. "12998.700000").
 * @returns The numeric value.
 * @throws Error when the string is not numeric.
 */
export function toNumber(decimalString: string): number {
  const value = Number(decimalString)
  if (Number.isNaN(value)) {
    throw new Error(`Not a decimal string: "${decimalString}"`)
  }
  return value
}

/**
 * Absolute tolerance for comparing amounts in a currency with the given number
 * of decimal places: one unit of the least significant digit.
 *
 * @param decimalPlaces - The currency's `quantityPrecision`.
 * @returns Tolerance value (e.g. 2 → 0.01).
 */
export function toleranceForPrecision(decimalPlaces: number): number {
  return 10 ** -decimalPlaces
}

/**
 * Half a unit of the least significant digit of a decimal string — the maximum
 * rounding error the API could have introduced when formatting the value
 * (assuming round-to-nearest). See docs/testing/decimal-assertions.md.
 *
 * @param decimalString - Decimal string as returned by the API (e.g. "0.00007692").
 * @returns Half-ULP (e.g. "0.00007692" → 0.5e-8).
 */
export function halfUlpOf(decimalString: string): number {
  const decimals = decimalString.split('.')[1]?.length ?? 0
  return 0.5 * 10 ** -decimals
}
