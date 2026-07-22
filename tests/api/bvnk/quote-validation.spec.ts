import * as allure from 'allure-js-commons'
import type { BvnkApi } from '../../../src/api/bvnk/bvnk-api.js'
import { findWalletByCurrency, getWallets } from '../../../src/api/bvnk/helpers/wallet.helpers.js'
import type {
  ApiErrorResponse,
  ValidationErrorResponse,
} from '../../../src/api/bvnk/models/error.model.js'
import type { QuoteRequest } from '../../../src/api/bvnk/models/quote.model.js'
import { expect, test } from '../../../src/api/fixtures/api.fixture.js'

/** Builds a valid ETH→TRX quote request for this worker's account, ready to be mutated per case. */
async function validQuoteRequest(bvnkApi: BvnkApi): Promise<QuoteRequest> {
  const wallets = await getWallets(bvnkApi)
  return {
    from: 'ETH',
    to: 'TRX',
    fromWallet: findWalletByCurrency(wallets, 'ETH').id,
    toWallet: findWalletByCurrency(wallets, 'TRX').id,
    amountIn: 1,
    useMaximum: false,
    useMinimum: false,
    reference: 'quote-validation',
    payInMethod: 'wallet',
    payOutMethod: 'wallet',
  }
}

test.describe('Quote input validation', () => {
  test('rejects a currency that does not match the source wallet (400)', async ({ bvnkApi }) => {
    const request = { ...(await validQuoteRequest(bvnkApi)), from: 'XXX' }

    const res = await bvnkApi.quotes.createRaw<QuoteRequest, ApiErrorResponse>(request)

    expect(res.status).toBe(400)
    expect(res.data.detail, 'error should explain the currency mismatch').toContain('XXX')
  })

  test('rejects a quote with a missing required field (422 with field location)', async ({
    bvnkApi,
  }) => {
    const { from: _from, ...requestWithoutFrom } = await validQuoteRequest(bvnkApi)

    const res = await bvnkApi.quotes.createRaw<Omit<QuoteRequest, 'from'>, ValidationErrorResponse>(
      requestWithoutFrom
    )

    expect(res.status).toBe(422)
    const missing = res.data.detail.find((d) => d.type === 'missing')
    expect(missing, 'validation error should identify the missing field').toBeDefined()
    expect(missing?.loc).toEqual(['body', 'from'])
  })

  test('rejects a zero amount (400)', async ({ bvnkApi }) => {
    const request = { ...(await validQuoteRequest(bvnkApi)), amountIn: 0 }

    const res = await bvnkApi.quotes.createRaw<QuoteRequest, ApiErrorResponse>(request)

    expect(res.status).toBe(400)
  })

  test('rejects a negative amount', async ({ bvnkApi }) => {
    // DEFECT (found during exploratory probing): the simulator returns 201 and creates a quote
    // with negative amountIn/amountOut. A negative trade amount is nonsensical and must be
    // rejected with a 4xx validation error. test.fail() documents the defect: this test is
    // EXPECTED to fail until the simulator is fixed — if it starts passing, Playwright flags it.
    test.fail(true, 'Known defect: simulator accepts negative amountIn (returns 201)')

    const request = { ...(await validQuoteRequest(bvnkApi)), amountIn: -5 }

    const res = await bvnkApi.quotes.createRaw<QuoteRequest, ApiErrorResponse>(request)
    await allure.attachment('Response', JSON.stringify(res.data, null, 2), 'application/json')

    expect(res.status, 'negative amounts must be rejected').toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  test('rejects a quote exceeding the available balance (412)', async ({ bvnkApi }) => {
    const request = { ...(await validQuoteRequest(bvnkApi)), amountIn: 999_999 }

    const res = await bvnkApi.quotes.createRaw<QuoteRequest, ApiErrorResponse>(request)

    expect(res.status).toBe(412)
    expect(res.data.detail).toContain('Insufficient funds')
  })

  test('returns 404 for an unknown quote uuid on get and accept', async ({ bvnkApi }) => {
    const unknownUuid = '00000000-0000-0000-0000-000000000000'

    await allure.step('GET unknown uuid → 404', async () => {
      const res = await bvnkApi.quotes.get(unknownUuid)
      expect(res.status).toBe(404)
    })

    await allure.step('PUT accept unknown uuid → 404', async () => {
      const res = await bvnkApi.quotes.accept(unknownUuid)
      expect(res.status).toBe(404)
    })
  })

  test('rejects a malformed quote uuid (422 uuid parsing error)', async ({ bvnkApi }) => {
    const res = await bvnkApi.quotes.get('not-a-uuid')

    expect(res.status).toBe(422)
    const body = res.data as unknown as ValidationErrorResponse
    expect(body.detail[0]?.type).toBe('uuid_parsing')
    expect(body.detail[0]?.loc).toEqual(['path', 'quote_uuid'])
  })
})
