import * as allure from 'allure-js-commons'
import { GLOBAL_CONST } from '../../../core/config/constants.js'
import { waitFor } from '../../../core/utils/generic-polling-helper.js'
import type { BvnkApi } from '../../../src/api/bvnk/bvnk-api.js'
import {
  halfUlpOf,
  toNumber,
  toleranceForPrecision,
} from '../../../src/api/bvnk/helpers/decimal.helpers.js'
import { findWalletByCurrency, getWallets } from '../../../src/api/bvnk/helpers/wallet.helpers.js'
import type { Quote } from '../../../src/api/bvnk/models/quote.model.js'
import { PAYMENT_STATUS, QUOTE_STATUS } from '../../../src/api/bvnk/models/quote.model.js'
import type { Wallet } from '../../../src/api/bvnk/models/wallet.model.js'
import { expect, test } from '../../../src/api/fixtures/api.fixture.js'

/** The three mandatory conversions from the task specification. */
const TRADES = [
  { amountIn: 1, fromCurrency: 'ETH', toCurrency: 'TRX' },
  { amountIn: 420, fromCurrency: 'TRX', toCurrency: 'USDT' },
  { amountIn: 987, fromCurrency: 'TRX', toCurrency: 'ETH' },
] as const

type Trade = (typeof TRADES)[number]

test.describe('E2E trades: currency conversions', () => {
  for (const trade of TRADES) {
    test(`converts ${trade.amountIn} ${trade.fromCurrency} to ${trade.toCurrency} and settles balances correctly`, async ({
      bvnkApi,
    }) => {
      await allure.severity('critical')
      await runTradeConversion(bvnkApi, trade)
    })
  }
})

/**
 * Executes the full trade lifecycle with step-level Allure reporting:
 * balance snapshot → create quote → validate → accept → await settlement → verify balances.
 *
 * @param bvnkApi - Authenticated BVNK API client set.
 * @param trade - Conversion parameters (amountIn, from, to).
 */
async function runTradeConversion(bvnkApi: BvnkApi, trade: Trade): Promise<void> {
  const { amountIn, fromCurrency, toCurrency } = trade

  let fromBefore: Wallet
  let toBefore: Wallet
  let quote: Quote
  let settled: Quote

  await allure.step('1. Precondition: capture wallet balances before the trade', async () => {
    const walletsBefore = await getWallets(bvnkApi)
    fromBefore = findWalletByCurrency(walletsBefore, fromCurrency)
    toBefore = findWalletByCurrency(walletsBefore, toCurrency)

    await allure.attachment(
      `Wallet ${fromCurrency} (before)`,
      JSON.stringify(fromBefore, null, 2),
      'application/json'
    )
    await allure.attachment(
      `Wallet ${toCurrency} (before)`,
      JSON.stringify(toBefore, null, 2),
      'application/json'
    )

    expect(
      toNumber(fromBefore.available),
      `${fromCurrency} balance must cover the trade`
    ).toBeGreaterThanOrEqual(amountIn)
  })

  await allure.step(`2. Create quote: ${amountIn} ${fromCurrency} → ${toCurrency}`, async () => {
    const createRes = await bvnkApi.quotes.create({
      from: fromCurrency,
      to: toCurrency,
      fromWallet: fromBefore.id,
      toWallet: toBefore.id,
      amountIn,
      useMaximum: false,
      useMinimum: false,
      reference: `e2e-${fromCurrency}-${toCurrency}`,
      payInMethod: 'wallet',
      payOutMethod: 'wallet',
    })

    expect(createRes.status, 'quote creation should return 201').toBe(201)
    quote = createRes.data

    await allure.attachment('Quote', JSON.stringify(quote, null, 2), 'application/json')
  })

  await allure.step('3. Validate quote: status, pair, expiry window, fee math', async () => {
    expect(quote.quoteStatus).toBe(QUOTE_STATUS.PENDING)
    expect(quote.from).toBe(fromCurrency)
    expect(quote.to).toBe(toCurrency)
    expect(toNumber(quote.amountIn)).toBe(amountIn)
    expect(
      quote.acceptanceExpiryDate - quote.dateCreated,
      `quote should expire ${GLOBAL_CONST.BVNK.QUOTE_EXPIRY_SECONDS}s after creation`
    ).toBe(GLOBAL_CONST.BVNK.QUOTE_EXPIRY_SECONDS)

    // Fee: 0.01% of amountIn, charged in the FROM currency (documented assumption — see quote.model.ts)
    const expectedFee = amountIn * GLOBAL_CONST.BVNK.SERVICE_FEE_RATE
    expect(toNumber(quote.fee)).toBeCloseTo(expectedFee, 10)

    // amountOut = (amountIn − fee) × price.
    // LIMITATION: the real BVNK API has an endpoint that returns the current exchange rate
    // independently of any quote (GET /api/currency/convert/{from}/{to}), but the simulator
    // does not implement it (verified: absent from its OpenAPI, probes → 404). The quote's own
    // `price` is therefore the only available rate source, so this assertion verifies internal
    // consistency of the quote (fee application), not rate correctness.
    //
    // Tolerance: the API computes with more decimal places than it sends back — the `price` and
    // `amountOut` strings are rounded (we saw this: recomputing amountOut from the returned
    // price gives a slightly different number). So we allow the maximum error that rounding
    // alone can cause: (amountIn − fee) × halfUlp(price) + halfUlp(amountOut).
    //
    // ASSUMPTION: we allow half a step of the last printed digit, which presumes the API rounds
    // to the nearest value. If it cuts off digits instead (truncates), the error could be twice
    // as big. We keep the tighter half-step on purpose: doubling the tolerance would make it
    // larger than the whole 0.01% fee on pairs with tiny prices (TRX→ETH) — the test could then
    // no longer tell whether the fee was applied at all. Details: docs/testing/decimal-assertions.md
    const expectedAmountOut = (amountIn - expectedFee) * toNumber(quote.price)
    const amountOutTolerance =
      (amountIn - expectedFee) * halfUlpOf(quote.price) + halfUlpOf(quote.amountOut)
    expect(
      Math.abs(toNumber(quote.amountOut) - expectedAmountOut),
      `amountOut should equal (amountIn − fee) × price within rounding tolerance ${amountOutTolerance}`
    ).toBeLessThanOrEqual(amountOutTolerance)
  })

  await allure.step('4. Accept the quote within its validity window', async () => {
    const acceptRes = await bvnkApi.quotes.accept(quote.uuid)

    expect(acceptRes.status, 'quote acceptance should return 200').toBe(200)
    expect(acceptRes.data.quoteStatus).toBe(QUOTE_STATUS.ACCEPTED)
    expect(acceptRes.data.acceptanceDate, 'acceptance date should be set').not.toBeNull()
  })

  await allure.step('5. Wait for asynchronous settlement', async () => {
    settled = await waitFor(
      async () => (await bvnkApi.quotes.get(quote.uuid)).data,
      (q) => q.paymentStatus === PAYMENT_STATUS.SUCCESS
    )
    expect(settled.quoteStatus).toBe(QUOTE_STATUS.PAYMENT_OUT_PROCESSED)

    await allure.attachment('Settled quote', JSON.stringify(settled, null, 2), 'application/json')
  })

  await allure.step('6. Verify balances: debit = amountIn, credit = amountOut', async () => {
    const walletsAfter = await getWallets(bvnkApi)
    const fromAfter = findWalletByCurrency(walletsAfter, fromCurrency)
    const toAfter = findWalletByCurrency(walletsAfter, toCurrency)

    await allure.attachment(
      `Wallet ${fromCurrency} (after)`,
      JSON.stringify(fromAfter, null, 2),
      'application/json'
    )
    await allure.attachment(
      `Wallet ${toCurrency} (after)`,
      JSON.stringify(toAfter, null, 2),
      'application/json'
    )

    const fromTolerance = toleranceForPrecision(fromBefore.currency.quantityPrecision)
    const toTolerance = toleranceForPrecision(toBefore.currency.quantityPrecision)

    const debited = toNumber(fromBefore.balance) - toNumber(fromAfter.balance)
    const credited = toNumber(toAfter.balance) - toNumber(toBefore.balance)

    // |actual − expected| ≤ tolerance: floats + rounded API strings make exact equality
    // impossible — see docs/testing/decimal-assertions.md ("The assertion pattern")
    expect(
      Math.abs(debited - amountIn),
      `${fromCurrency} debit should equal amountIn`
    ).toBeLessThanOrEqual(fromTolerance)
    expect(
      Math.abs(credited - toNumber(settled.amountOut)),
      `${toCurrency} credit should equal quoted amountOut`
    ).toBeLessThanOrEqual(toTolerance)

    // available should track balance after settlement
    expect(fromAfter.available).toBe(fromAfter.balance)
    expect(toAfter.available).toBe(toAfter.balance)
  })
}
