# BVNK API Test Automation

[![API Tests](https://github.com/TsvetanTsvetkov84/bvnk-automation/actions/workflows/api-tests.yml/badge.svg)](https://github.com/TsvetanTsvetkov84/bvnk-automation/actions/workflows/api-tests.yml)
[![Allure Report](https://img.shields.io/badge/Allure-live%20report-blueviolet)](https://tsvetantsvetkov84.github.io/bvnk-automation/)

Solution for the **BVNK QA Engineering Task: API Testing** — end-to-end tests for
currency conversion/trades against the [BVNK API simulator](https://bvnkapisimulator.pythonanywhere.com/docs),
built with **TypeScript + Playwright + Allure**, CI on **GitHub Actions**, and an optional
**Postgres + Grafana** observability pipeline for flakiness tracking.

- 📊 **Live Allure report:** <https://tsvetantsvetkov84.github.io/bvnk-automation/>
- ▶️ **Trigger a run yourself:** comment `/run-tests` on the pinned issue — no account access needed
- 📈 **Live flakiness dashboards:** <https://grafana.tsvetan-tsvetkov.eu/> (credentials provided in the submission email)

## Quick start

```bash
yarn install
yarn test:api        # runs the suite against the live simulator
yarn allure:open     # serves the Allure report locally
```

No configuration required — the simulator URL is the default. Node ≥ 22, Yarn 1.x.

## The tests

**22 tests, ~25s wall-clock** (parallel workers, each with its own isolated `/init` account).

| Spec                        | Covers                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trade-conversions.spec.ts` | **The 3 mandatory E2E trades** (1 ETH→TRX, 420 TRX→USDT, 987 TRX→ETH), data-driven; 6 Allure steps each: balance snapshot → create quote → validate (status, pair, 20s expiry window, fee math) → accept → await async settlement → verify debit/credit |
| `auth.spec.ts`              | 401 for missing/invalid bearer token across endpoints; `/echo` round-trip                                                                                                                                                                               |
| `quote-lifecycle.spec.ts`   | Quote expires after 20s (accept → 412, status `EXPIRED`); double-accept rejected; list/get consistency                                                                                                                                                  |
| `quote-validation.spec.ts`  | Currency/wallet mismatch (400), missing field (422 with field location), zero amount, insufficient funds (412), unknown/malformed uuid, **negative amount — known defect, see Findings**                                                                |
| `wallet.spec.ts`            | Funded wallets precondition for the trade currencies, get-by-id, pagination (`offset`/`max_count`), unknown/non-numeric id                                                                                                                              |

## Approach

**Expectations trace to a source, never to the system under test.** Every assertion is
classified as: (a) task-spec requirement, (b) documented API contract (simulator OpenAPI /
official [BVNK API reference](https://docs.bvnk.com/)), or (c) an explicitly labeled
assumption. Exploratory probing was used to learn _mechanics_ (status codes for
unspecified errors are pinned as regression checks and labeled as such) — but never to
launder observed behavior into "correct behavior".

**Design decisions worth reviewing:**

- **Isolation & parallelism** — each Playwright worker creates its own simulated account
  via `/init`; tests are order- and placement-independent (balance assertions use
  before/after deltas, never absolute values)
- **Rate fluctuation & async settlement** — trades assert against the accepted quote's own
  price (the simulator offers no independent exchange-rate endpoint — verified), and poll
  for settlement (`PROCESSING → SUCCESS`, discovered to be asynchronous) instead of sleeping;
  the only hard wait in the suite is the expiry test, where elapsed time _is_ the behavior under test
- **Money assertions** — `|actual − expected| ≤ tolerance` with tolerances derived from
  each response string's own precision (half-ULP error propagation). Full write-up:
  [docs/testing/decimal-assertions.md](docs/testing/decimal-assertions.md)
- **Extensible structure** — the simulator is one service under test among possible many:
  `src/api/bvnk/` (models/clients/helpers per service) over a transport-agnostic
  `core/api/` HTTP client ([design](core/api/README.md)); adding a service = new folder +
  suite entry, no framework changes

## Findings & assumptions

Found while building the suite (all verified, reproducible):

1. **DEFECT — negative amounts accepted:** `POST /api/v1/quote` with `amountIn: -5`
   returns **201** and creates a quote with negative `amountOut`. Expected: 4xx validation
   error. Covered by a `test.fail()`-marked test that will flag itself when fixed.
2. **Broken URL in the task PDF:** the PDF references `bvnksimulator.pythonanywhere.com`
   (404); the working host from the assessment email is `bvnkapisimulator.pythonanywhere.com`
   (note the extra "api" in the name).
3. **Simulator/API status divergence:** the simulator emits `quoteStatus: EXPIRED` and
   `paymentStatus: PROCESSING`/`EXPIRED` — none of which exist in the official
   `QuoteDto` enums from BVNK's OpenAPI export.
4. **ASSUMPTION — fee formula:** the spec states a 0.01% service fee but no source
   (task PDF, simulator docs, official API reference) defines _how_ it is applied. Tests
   assert `fee = amountIn × 0.01%` in the FROM currency and `amountOut = (amountIn − fee) × price`
   — corroborated by the official schema's `amountInGross`/`amountInNet` field pair
   (documented in `src/api/bvnk/models/quote.model.ts`).
5. **ASSUMPTION — rounding mode:** tolerances presume round-to-nearest; rationale and the
   fee-detectability trade-off in [docs/testing/decimal-assertions.md](docs/testing/decimal-assertions.md).

## CI/CD & reporting

GitHub Actions ([api-tests.yml](.github/workflows/api-tests.yml)): quality gates
(lint, typecheck, prettier, filename conventions) → API tests → **Allure report published
to GitHub Pages** with run-over-run history. Triggers: every push, nightly cron (builds
the flakiness dataset), manual dispatch, and **`/run-tests` issue comments** so external
reviewers can start runs without repo access.

Everything needed to run the tests is free and account-less. Two optional integrations
activate only when secrets are configured, and skip with a logged warning otherwise:

- **Result persistence** — each test result (status, duration, retry, build id) is written
  to Postgres on my VPS over a restricted SSH tunnel, feeding Grafana dashboards
  (pass/fail trends, flakiness rate per test, duration percentiles)
- **AI-assisted failure review** — on CI failures, the failure context (errors, stack
  traces, network errors from the Playwright trace) is sent to Claude for root-cause
  classification (`flaky | bug | env-issue | assertion`), attached to the Allure report
  and persisted alongside the result. Architecture: [docs/ai/ai-assisted-failure-review.md](docs/ai/ai-assisted-failure-review.md)

## Project structure

```
configs/          Playwright configs + suite registry
core/             Service-agnostic building blocks
  api/            HTTP client abstraction (auth strategies, typed responses)
  ai/             AI failure-review (provider-agnostic client + analyzer)
  config/         Zod-validated env configuration
  db/             Postgres client + test-results repository
  reporting/      Allure tooling, failure collector, test-result reporter
src/api/
  bvnk/           BVNK service under test: models, clients, helpers
  fixtures/       Worker-scoped account fixture + reporting hooks
tests/api/bvnk/   The specs
docs/             Design docs (testing, AI review, code quality)
```

## Reviewer access (optional)

The broader setup this project plugs into — live behind Basic Auth (credentials in the
submission email):

| URL                                                                | What's there                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [grafana.tsvetan-tsvetkov.eu](https://grafana.tsvetan-tsvetkov.eu) | Test-results dashboards: flakiness rates, AI failure analysis                                               |
| [git.tsvetan-tsvetkov.eu](https://git.tsvetan-tsvetkov.eu)         | Self-hosted Gitea — infrastructure-as-code repo (Docker/Traefik stack) and the broader automation portfolio |
| [tsvetan-tsvetkov.eu](https://tsvetan-tsvetkov.eu)                 | Landing page for the whole setup                                                                            |
