import { expect } from '@playwright/test'
import type { BvnkApi } from '../bvnk-api.js'
import type { Wallet } from '../models/wallet.model.js'

/**
 * Finds the account wallet holding the given currency.
 * Wallet ids are generated per simulated account, so tests must always look wallets up
 * by currency code — never hardcode ids.
 *
 * @param wallets - Wallets returned by `GET /api/wallet`.
 * @param currencyCode - Currency code to search for (e.g. "ETH").
 * @returns The matching wallet.
 * @throws Error when no wallet holds the currency (message lists available codes).
 */
export function findWalletByCurrency(wallets: readonly Wallet[], currencyCode: string): Wallet {
  const wallet = wallets.find((w) => w.currency.code === currencyCode)
  if (!wallet) {
    const available = wallets.map((w) => w.currency.code).join(', ')
    throw new Error(`No wallet found for currency "${currencyCode}" (available: ${available})`)
  }
  return wallet
}

/**
 * Fetches all wallets and asserts the request succeeded.
 *
 * @param api - Authenticated BVNK API client set.
 * @returns The account's wallets.
 */
export async function getWallets(api: BvnkApi): Promise<Wallet[]> {
  const res = await api.wallets.list()
  expect(res.status, 'GET /api/wallet should succeed').toBe(200)
  return res.data
}
