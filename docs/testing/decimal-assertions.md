# Asserting on Monetary Values — Rounding-Aware Tolerances

How the E2E trade tests compare recomputed amounts against the API's decimal-string
responses without false failures from rounding, and without losing the ability to
detect a missing fee. Implemented in `src/api/bvnk/helpers/decimal.helpers.ts`
(`halfUlpOf`), used by `tests/api/bvnk/trade-conversions.spec.ts` (step 3).

## The problem

The API returns money as fixed-decimal strings (`"price": "0.00007692"`), but computes
internally at higher precision. When a test recomputes

```
expectedAmountOut = (amountIn − fee) × price
```

it uses the **rounded** `price` string, while the API used the **unrounded** rate — so an
exact-equality assertion fails even when the API is correct. The effect is worst for
pairs with tiny prices: for 987 TRX → ETH, the rounding of `price` alone shifts the
result by up to ~0.000005 ETH.

## The tool: half-ULP

```ts
halfUlpOf(decimalString) = 0.5 * 10 ** -decimals
```

- `10 ** -decimals` — the value of **one unit in the last printed decimal place**
  (the "ULP", _unit in the last place_). `"0.00007692"` has 8 decimals → `10⁻⁸`.
- `0.5 ×` — with round-to-nearest, the true value lies **at most half a step** from the
  printed one; anything further would have rounded to a different last digit:

```
printed:    0.00007692
true value: somewhere in [0.000076915 … 0.000076925)
max error:  ±0.000000005  ( = 0.5 × 10⁻⁸ )
```

`halfUlpOf` is therefore _"the biggest amount this printed number can differ from the
value it was rounded from"_ — derived per response string, not a hardcoded epsilon.

## The tolerance formula

Propagating both rounding sources through the formula:

```
|amountOut − (amountIn − fee) × price| ≤ (amountIn − fee) × halfUlp(price) + halfUlp(amountOut)
```

- first term — the `price` rounding error, scaled by the amount it multiplies
- second term — the rounding of the `amountOut` string itself

## The assertion pattern: `Math.abs(actual − expected) ≤ tolerance`

All balance/amount checks are written as one shape (see `trade-conversions.spec.ts`, step 6):

```ts
expect(Math.abs(debited - amountIn), '...').toBeLessThanOrEqual(fromTolerance)
```

It reads as: **"equal, within a small allowed error"** — three parts, each necessary:

1. **Why not `toEqual`?** Two independent reasons exact equality would fail on _correct_
   API responses:
   - JavaScript floats cannot represent most decimals: `3.7 - 2.7` evaluates to
     `0.9999999999999998`, not `1`.
   - The API's decimal strings are themselves rounded (see above), so even ideal math
     can be off by a fraction of the last digit.

2. **Why `Math.abs`?** Direction doesn't matter — a debit of `0.99999…` (too little) and
   `1.00000…2` (too much) are equally fine within tolerance and equally wrong outside it.
   The absolute value folds both into a single "distance from expected".

3. **Why `toBeLessThanOrEqual(tolerance)`?** The distance must stay within what float
   representation and API rounding can explain. For balances the tolerance is
   `toleranceForPrecision(currency.quantityPrecision)` — one unit of the currency's last
   decimal place, i.e. the smallest difference the currency can even express.

Playwright's built-in `toBeCloseTo(value, digits)` is the same idea but takes a _digit
count_, not an absolute tolerance — unusable here because every currency has a different
precision, and we want the failure message to state exactly how much slack was allowed.

## Why not something simpler?

- **Exact equality** — false failures (see above).
- **A fixed epsilon / `toBeCloseTo(n)`** — either too tight for TRX→ETH (false failures)
  or too loose for ETH→TRX (masks real errors). Ten decimal digits of price ≠ ten
  decimal digits of a 12 000-TRX amount.
- **Full-ULP tolerance** — for TRX→ETH the bound (~9.9e-6 ETH) would exceed the entire
  0.01% fee effect (~7.6e-6 ETH), so the assertion could no longer detect a missing fee.

## Source classification (per project convention)

| Claim                                                         | Source                                                                                                                                                                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amounts/prices are fixed-decimal strings                      | **Documentation** — OpenAPI regex patterns on the fields                                                                                                                                                   |
| The strings are rounded views of more precise internal values | **Inference** — exact recomputation demonstrably differs                                                                                                                                                   |
| Rounding is round-to-nearest (the `0.5 ×`)                    | **Assumption** — undocumented; if the API truncates, the error can reach a full ULP. Kept deliberately: half-ULP is the widest tolerance that still keeps the fee effect detectable on all mandatory pairs |
