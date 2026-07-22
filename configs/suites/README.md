# `suites/suites.ts`

Central registry that maps each suite name to its Playwright config.

| Suite | Config file                |
| ----- | -------------------------- |
| `api` | `playwright.api.config.ts` |

The registry exists so the project can grow to multiple suites (e.g. additional services,
contract tests, performance) without changing the runner — adding an entry here is all
that's needed.

The `SuiteName` type is derived directly from the `SUITES` keys, so adding a new suite
automatically expands the type.
