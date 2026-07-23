import * as allure from 'allure-js-commons'
import { createBvnkApi } from '../../src/api/bvnk/bvnk-api.js'
import type { ApiErrorResponse } from '../../src/api/bvnk/models/error.model.js'
import { expect, test } from '../../src/api/fixtures/api.fixture.js'

/**
 * Authentication behavior of the protected endpoints.
 *
 * Expected status: 401 per RFC 6750 (Bearer Token usage) for both missing and invalid
 * credentials — the task spec only states endpoints are "protected with Bearer Token
 * authentication" without defining codes.
 */
test.describe('Authentication', () => {
  test('rejects requests without a bearer token with 401', async ({ config }) => {
    await allure.severity('critical')
    const anonymousApi = createBvnkApi(config.BVNK_BASE_URL)

    await allure.step('GET /api/wallet without token → 401', async () => {
      const res = await anonymousApi.wallets.list()
      expect(res.status).toBe(401)
      expect((res.data as unknown as ApiErrorResponse).detail).toBeTruthy()
    })

    await allure.step('GET /api/v1/quote without token → 401', async () => {
      const res = await anonymousApi.quotes.list()
      expect(res.status).toBe(401)
    })

    await allure.step('POST /echo without token → 401', async () => {
      const res = await anonymousApi.auth.echo({ ping: true })
      expect(res.status).toBe(401)
    })
  })

  test('rejects requests with an invalid bearer token with 401', async ({ config }) => {
    await allure.severity('critical')
    const invalidTokenApi = createBvnkApi(config.BVNK_BASE_URL, () => 'invalid-token-123')

    await allure.step('GET /api/wallet with invalid token → 401', async () => {
      const res = await invalidTokenApi.wallets.list()
      expect(res.status).toBe(401)
    })

    await allure.step('GET /api/v1/quote with invalid token → 401', async () => {
      const res = await invalidTokenApi.quotes.list()
      expect(res.status).toBe(401)
    })
  })

  test('authenticated /echo returns token expiry and echoes the request body', async ({
    bvnkApi,
  }) => {
    const payload = { trade: { from: 'ETH', to: 'TRX' }, nested: [1, 2, 3] }

    const res = await bvnkApi.auth.echo(payload)

    expect(res.status).toBe(200)
    expect(res.data.request_payload, 'body should be echoed back unchanged').toEqual(payload)
    // Task spec: "this endpoint will return the expiry time for the token"
    expect(res.data.auth_token_expiry_time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})
