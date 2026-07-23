import { setTimeout as sleep } from 'node:timers/promises'
import * as allure from 'allure-js-commons'
import { GLOBAL_CONST } from '../../../core/config/constants.js'
import type { BvnkApi } from '../../../src/api/bvnk/bvnk-api.js'
import { findWalletByCurrency, getWallets } from '../../../src/api/bvnk/helpers/wallet.helpers.js'
import type { Quote } from '../../../src/api/bvnk/models/quote.model.js'
import { PAYMENT_STATUS, QUOTE_STATUS } from '../../../src/api/bvnk/models/quote.model.js'
import { expect, test } from '../../../src/api/fixtures/api.fixture.js'

/** Creates a small valid ETH→TRX quote for lifecycle testing. */
async function createTestQuote(bvnkApi: BvnkApi): Promise<Quote> {
  const wallets = await getWallets(bvnkApi)
  const res = await bvnkApi.quotes.create({
    from: 'ETH',
    to: 'TRX',
    fromWallet: findWalletByCurrency(wallets, 'ETH').id,
    toWallet: findWalletByCurrency(wallets, 'TRX').id,
    amountIn: 0.1,
    useMaximum: false,
    useMinimum: false,
    reference: 'quote-lifecycle',
    payInMethod: 'wallet',
    payOutMethod: 'wallet',
  })
  expect(res.status, 'test quote creation should succeed').toBe(201)
  return res.data
}

test.describe('Quote lifecycle rules', () => {
  test('quote expires after 20s and can no longer be accepted', async ({ bvnkApi }) => {
    // This test legitimately waits out the full expiry window — extend its budget beyond the
    // 30s suite default, derived from the same business-rule constant it verifies
    test.setTimeout((GLOBAL_CONST.BVNK.QUOTE_EXPIRY_SECONDS + 40) * 1000)
    await allure.severity('critical')

    let quote: Quote

    await allure.step('1. Create a quote', async () => {
      quote = await createTestQuote(bvnkApi)
      expect(quote.quoteStatus).toBe(QUOTE_STATUS.PENDING)
    })

    await allure.step(
      `2. Wait past the ${GLOBAL_CONST.BVNK.QUOTE_EXPIRY_SECONDS}s validity window`,
      async () => {
        // Task spec: "All quotes will expire after 20 seconds if not accepted."
        // Deliberate hard wait — elapsed time itself is the behavior under test here
        await sleep((GLOBAL_CONST.BVNK.QUOTE_EXPIRY_SECONDS + 2) * 1000)
      }
    )

    await allure.step('3. Accepting the expired quote is rejected (412)', async () => {
      const acceptRes = await bvnkApi.quotes.accept(quote.uuid)
      expect(acceptRes.status, 'accepting an expired quote must fail').toBe(412)
    })

    await allure.step('4. The quote reports EXPIRED status', async () => {
      const getRes = await bvnkApi.quotes.get(quote.uuid)
      expect(getRes.status).toBe(200)
      expect(getRes.data.quoteStatus).toBe(QUOTE_STATUS.EXPIRED)
      expect(getRes.data.paymentStatus).toBe(PAYMENT_STATUS.EXPIRED)
    })
  })

  test('an accepted quote cannot be accepted twice', async ({ bvnkApi }) => {
    let quote: Quote

    await allure.step('1. Create and accept a quote', async () => {
      quote = await createTestQuote(bvnkApi)
      const acceptRes = await bvnkApi.quotes.accept(quote.uuid)
      expect(acceptRes.status).toBe(200)
      expect(acceptRes.data.quoteStatus).toBe(QUOTE_STATUS.ACCEPTED)
    })

    await allure.step('2. Second accept is rejected (400)', async () => {
      const secondAccept = await bvnkApi.quotes.accept(quote.uuid)
      expect(secondAccept.status, 'double acceptance must be rejected').toBe(400)
    })
  })

  test('created quotes appear in the quote list', async ({ bvnkApi }) => {
    let quote: Quote

    await allure.step('1. Create a quote', async () => {
      quote = await createTestQuote(bvnkApi)
    })

    await allure.step('2. GET /api/v1/quote contains it', async () => {
      const listRes = await bvnkApi.quotes.list()
      expect(listRes.status).toBe(200)
      const uuids = listRes.data.map((q) => q.uuid)
      expect(uuids).toContain(quote.uuid)
    })

    await allure.step('3. GET by uuid returns the same quote', async () => {
      const getRes = await bvnkApi.quotes.get(quote.uuid)
      expect(getRes.status).toBe(200)
      expect(getRes.data.id).toBe(quote.id)
      expect(getRes.data.amountIn).toBe(quote.amountIn)
    })
  })
})
