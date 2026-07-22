import * as allure from 'allure-js-commons'
import { GLOBAL_CONST } from '../../../core/config/constants.js'
import { waitFor } from '../../../core/utils/generic-polling-helper.js'
import { toNumber, toleranceForPrecision } from '../../../src/api/bvnk/helpers/decimal.helpers.js'
import { findWalletByCurrency, getWallets } from '../../../src/api/bvnk/helpers/wallet.helpers.js'
import type { Quote } from '../../../src/api/bvnk/models/quote.model.js'
import { PAYMENT_STATUS, QUOTE_STATUS } from '../../../src/api/bvnk/models/quote.model.js'
import type { Wallet } from '../../../src/api/bvnk/models/wallet.model.js'
import { expect, test } from '../../../src/api/fixtures/api.fixture.js'

const AMOUNT_IN = 1
const FROM = 'ETH'
const TO = 'TRX'

test.describe(`E2E trade: convert ${AMOUNT_IN} ${FROM} for ${TO}`, () => {
  test(`converts ${AMOUNT_IN} ${FROM} to ${TO} and settles balances correctly`, async ({
    bvnkApi,
  }) => {
    await allure.severity('critical')

    let fromBefore: Wallet
    let toBefore: Wallet
    let quote: Quote
    let settled: Quote

    await allure.step('1. Precondition: capture wallet balances before the trade', async () => {
      const walletsBefore = await getWallets(bvnkApi)
      fromBefore = findWalletByCurrency(walletsBefore, FROM)
      toBefore = findWalletByCurrency(walletsBefore, TO)

      await allure.attachment(
        'Balances before',
        JSON.stringify({ [FROM]: fromBefore.balance, [TO]: toBefore.balance }, null, 2),
        'application/json'
      )

      expect(
        toNumber(fromBefore.available),
        `${FROM} balance must cover the trade`
      ).toBeGreaterThanOrEqual(AMOUNT_IN)
    })

    await allure.step(`2. Create quote: ${AMOUNT_IN} ${FROM} → ${TO}`, async () => {
      const createRes = await bvnkApi.quotes.create({
        from: FROM,
        to: TO,
        fromWallet: fromBefore.id,
        toWallet: toBefore.id,
        amountIn: AMOUNT_IN,
        useMaximum: false,
        useMinimum: false,
        reference: `e2e-${FROM}-${TO}`,
        payInMethod: 'wallet',
        payOutMethod: 'wallet',
      })

      expect(createRes.status, 'quote creation should return 201').toBe(201)
      quote = createRes.data

      await allure.attachment('Quote', JSON.stringify(quote, null, 2), 'application/json')
    })

    await allure.step('3. Validate quote: status, pair, expiry window, fee math', async () => {
      expect(quote.quoteStatus).toBe(QUOTE_STATUS.PENDING)
      expect(quote.from).toBe(FROM)
      expect(quote.to).toBe(TO)
      expect(toNumber(quote.amountIn)).toBe(AMOUNT_IN)
      expect(
        quote.acceptanceExpiryDate - quote.dateCreated,
        `quote should expire ${GLOBAL_CONST.BVNK.QUOTE_EXPIRY_SECONDS}s after creation`
      ).toBe(GLOBAL_CONST.BVNK.QUOTE_EXPIRY_SECONDS)

      // Fee: 0.01% of amountIn, charged in the FROM currency (documented assumption — see quote.model.ts)
      const expectedFee = AMOUNT_IN * GLOBAL_CONST.BVNK.SERVICE_FEE_RATE
      expect(toNumber(quote.fee)).toBeCloseTo(expectedFee, 10)

      // amountOut = (amountIn − fee) × price.
      // LIMITATION: the real BVNK API exposes an independent rate oracle
      // (GET /api/currency/convert/{from}/{to}) but the simulator does not implement it
      // (verified: absent from its OpenAPI, probes → 404). The quote's own `price` is therefore
      // the only available rate source, so this assertion verifies internal consistency of the
      // quote (fee application), not rate correctness.
      const expectedAmountOut = (AMOUNT_IN - expectedFee) * toNumber(quote.price)
      const toPrecision = toBefore.currency.quantityPrecision
      expect(toNumber(quote.amountOut)).toBeCloseTo(expectedAmountOut, toPrecision - 1)
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
      const fromAfter = findWalletByCurrency(walletsAfter, FROM)
      const toAfter = findWalletByCurrency(walletsAfter, TO)

      await allure.attachment(
        'Balances after',
        JSON.stringify({ [FROM]: fromAfter.balance, [TO]: toAfter.balance }, null, 2),
        'application/json'
      )

      const fromTolerance = toleranceForPrecision(fromBefore.currency.quantityPrecision)
      const toTolerance = toleranceForPrecision(toBefore.currency.quantityPrecision)

      const debited = toNumber(fromBefore.balance) - toNumber(fromAfter.balance)
      const credited = toNumber(toAfter.balance) - toNumber(toBefore.balance)

      expect(
        Math.abs(debited - AMOUNT_IN),
        `${FROM} debit should equal amountIn`
      ).toBeLessThanOrEqual(fromTolerance)
      expect(
        Math.abs(credited - toNumber(settled.amountOut)),
        `${TO} credit should equal quoted amountOut`
      ).toBeLessThanOrEqual(toTolerance)

      // available should track balance after settlement
      expect(fromAfter.available).toBe(fromAfter.balance)
      expect(toAfter.available).toBe(toAfter.balance)
    })
  })
})
