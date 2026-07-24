import * as allure from 'allure-js-commons'
import { toNumber } from '../../src/api/bvnk/helpers/decimal.helpers.js'
import { findWalletByCurrency } from '../../src/api/bvnk/helpers/wallet.helpers.js'
import type { ValidationErrorResponse } from '../../src/api/bvnk/models/error.model.js'
import { expect, test } from '../../src/api/fixtures/api.fixture.js'

/** Currencies the mandatory trades require — a fresh account must provide a wallet for each. */
const REQUIRED_CURRENCIES = ['ETH', 'TRX', 'USDT'] as const

test.describe('Wallets', () => {
  test('a fresh account provides funded wallets for all trade currencies', async ({ bvnkApi }) => {
    await allure.severity('critical')

    const res = await bvnkApi.wallets.list()
    expect(res.status).toBe(200)

    await allure.attachment(
      'Wallets',
      JSON.stringify(
        res.data.map((w) => ({ id: w.id, currency: w.currency.code, balance: w.balance })),
        null,
        2
      ),
      'application/json'
    )

    for (const currency of REQUIRED_CURRENCIES) {
      const wallet = findWalletByCurrency(res.data, currency)
      // Task spec: /init sets up "default wallet balances" — trades require funds to exist
      expect(toNumber(wallet.balance), `${currency} wallet should be funded`).toBeGreaterThan(0)
      expect(wallet.available, 'available should equal balance on a fresh account').toBe(
        wallet.balance
      )
    }
  })

  test('get wallet by id returns the same wallet as the list', async ({ bvnkApi }) => {
    const listRes = await bvnkApi.wallets.list()
    expect(listRes.status).toBe(200)
    const expected = listRes.data[0]
    if (!expected) throw new Error('Account has no wallets')

    const getRes = await bvnkApi.wallets.get(expected.id)

    expect(getRes.status).toBe(200)
    expect(getRes.data.id).toBe(expected.id)
    expect(getRes.data.currency.code).toBe(expected.currency.code)
    expect(getRes.data.balance).toBe(expected.balance)
  })

  test('supports pagination via offset and max_count', async ({ bvnkApi }) => {
    const all = (await bvnkApi.wallets.list()).data

    await allure.step('max_count limits the page size', async () => {
      const res = await bvnkApi.wallets.list({ max_count: 2 })
      expect(res.status).toBe(200)
      expect(res.data.length).toBe(Math.min(2, all.length))
      expect(res.data.map((w) => w.id)).toEqual(all.slice(0, 2).map((w) => w.id))
    })

    await allure.step('offset skips preceding wallets', async () => {
      const res = await bvnkApi.wallets.list({ offset: 2 })
      expect(res.status).toBe(200)
      expect(res.data.map((w) => w.id)).toEqual(all.slice(2).map((w) => w.id))
    })

    await allure.step('offset beyond the last wallet returns an empty list', async () => {
      const res = await bvnkApi.wallets.list({ offset: all.length + 10 })
      expect(res.status).toBe(200)
      expect(res.data).toEqual([])
    })
  })

  test('returns 404 for an unknown wallet id', async ({ bvnkApi }) => {
    // Logical assumption: 404 is not in the simulator's OpenAPI (documents only 200/201/422);
    // pinned from observed behaviour as a regression check. See README → Status-code provenance.
    const res = await bvnkApi.wallets.get(999_999)
    expect(res.status).toBe(404)
  })

  test('rejects a non-numeric wallet id (422 parsing error)', async ({ bvnkApi }) => {
    // Route as string on purpose — the client types walletId as number, so go through the raw path
    const res = await bvnkApi.wallets.get('abc' as unknown as number)

    expect(res.status).toBe(422)
    const body = res.data as unknown as ValidationErrorResponse
    expect(body.detail[0]?.type).toBe('int_parsing')
    expect(body.detail[0]?.loc).toEqual(['path', 'wallet_id'])
  })
})
