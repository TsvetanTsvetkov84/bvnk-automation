import * as allure from 'allure-js-commons'
import type { BvnkApi } from '../../src/api/bvnk/bvnk-api.js'
import { findWalletByCurrency, getWallets } from '../../src/api/bvnk/helpers/wallet.helpers.js'
import type {
  ApiErrorResponse,
  ValidationErrorResponse,
} from '../../src/api/bvnk/models/error.model.js'
import type { QuoteRequest } from '../../src/api/bvnk/models/quote.model.js'
import { expect, test } from '../../src/api/fixtures/api.fixture.js'

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
    // Logical assumption: 400 is not in the simulator's OpenAPI (documents only 200/201/422);
    // pinned from observed behaviour as a regression check. See README → Status-code provenance.
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
    // Logical assumption: 400 is not in the simulator's OpenAPI (documents only 200/201/422);
    // pinned from observed behaviour as a regression check. See README → Status-code provenance.
    const request = { ...(await validQuoteRequest(bvnkApi)), amountIn: 0 }

    const res = await bvnkApi.quotes.createRaw<QuoteRequest, ApiErrorResponse>(request)

    expect(res.status).toBe(400)
  })

  test('negative amount is accepted (201) — based on ASSUMPTION, see Findings', async ({
    bvnkApi,
  }) => {
    await allure.severity('minor')
    await allure.tag('product-sense-concern')
    // CHARACTERIZATION TEST — pins the API's ACTUAL behaviour, which its contract permits.
    //
    // ASSUMPTION (product-sense, not a contract rule): a negative trade amount looks illogical and strange and
    // arguably ought to be rejected. But the simulator's OpenAPI PERMITS negatives (the amountIn
    // string regex allows a leading '-'; the numeric branch sets no minimum), and no source (task
    // PDF, simulator OpenAPI, official BVNK docs) requires rejection. Asserting a 4xx here would
    // assert against the contract, so instead we pin what actually happens: a 201 and a quote that
    // carries the negative amount through. If BVNK ever changes this (starts rejecting, or
    // normalises the sign), THIS test turns red and we revisit the assumption — see README Findings.

    const request = { ...(await validQuoteRequest(bvnkApi)), amountIn: -5 }

    const res = await bvnkApi.quotes.create(request)
    await allure.attachment('Response', JSON.stringify(res.data, null, 2), 'application/json')

    expect(res.status, 'the simulator accepts negative amounts (contract-conformant)').toBe(201)
    expect(
      Number(res.data.amountOut),
      'the created quote propagates the negative amount'
    ).toBeLessThan(0)
  })

  test('rejects a quote exceeding the available balance (412)', async ({ bvnkApi }) => {
    // Logical assumption: 412 is not in the simulator's OpenAPI (documents only 200/201/422);
    // pinned from observed behaviour as a regression check. See README → Status-code provenance.
    const request = { ...(await validQuoteRequest(bvnkApi)), amountIn: 999_999 }

    const res = await bvnkApi.quotes.createRaw<QuoteRequest, ApiErrorResponse>(request)

    expect(res.status).toBe(412)
    expect(res.data.detail).toContain('Insufficient funds')
  })

  test('returns 404 for an unknown quote uuid on get and accept', async ({ bvnkApi }) => {
    // Logical assumption: 404 is not in the simulator's OpenAPI (documents only 200/201/422);
    // pinned from observed behaviour as a regression check. See README → Status-code provenance.
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
