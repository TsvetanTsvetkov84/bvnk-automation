# Per-Test Result Recording — Why an Auto Fixture, Not `afterEach`

Every test result must be recorded **after each individual test, in every spec file**:

1. attach the result to the **Allure** report (always),
2. when DB env is configured, **persist** it to Postgres (feeds the Grafana dashboard), and
3. on a non-passing test, run **AI failure analysis** and store the verdict.

Step 3 is the reason this mechanism matters: **the automatic failure review only runs if this
hook fires for the failing test.** If the hook silently skips a spec, that spec's failures are
never analysed and never persisted — the dashboard shows a hole, not an error.

The obvious way to do this is `test.afterEach`. It is also **the wrong way here**, and it fails
silently. This doc explains why, and what we use instead.

## The trap: `test.afterEach` in a shared module is file-scoped

The reporting logic lives in the shared fixture module `src/api/fixtures/api.fixture.ts`, which
every spec imports to get the `test` object. The naive version put the hook at the top level of
that module:

```ts
// api.fixture.ts  — ❌ silently records only ONE spec's tests
test.afterEach(async ({ db }, testInfo) => {
  /* attach to Allure, persist, run AI review */
})
```

Playwright's docs are explicit that hooks are **file-scoped**
([test.afterEach](https://playwright.dev/docs/api/class-test#test-after-each)):

> "When called in the scope of a test file, runs after each test **in the file**. When called
> inside a `test.describe()` group, runs after each test in the group."

The operative words are **"in the file."** A top-level `afterEach` registers against the file
whose scope is active **when the registration line executes** — and that line executes exactly
once, because of module caching:

- Node/ESM runs a module's body **once per process**, on first import. Every later `import`
  returns the cached module without re-running the body.
- So `test.afterEach(...)` is called **once**, while the **first** spec that imports the fixture
  is being loaded. The hook binds to **that one spec's scope**.
- The other specs import the cached module — its body never re-runs — so they register **no
  hook at all**.

### What this looked like in practice

A 21-test suite persisted only a handful of results, with **no errors logged** (the hook was
never invoked, so nothing could throw). Reproduced with `--workers=1` (all tests in one process)
and instrumentation:

| Observation                  | Result                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| `afterEach` fired for        | **3 of 21 tests — all from `auth.spec.ts`** (the first spec loaded) |
| Fixture module body executed | **once per process** (5 importing specs → 1 execution)              |
| Rows persisted               | 3 (one per test that actually ran the hook)                         |

"Runs after each test" ✅ and "only one spec's tests fired" ✅ are the **same fact** once you add
the file-scope qualifier: it ran after each test **in the file it was bound to**, and that was
one file.

## The fix: an `auto` fixture

Fixtures are resolved from Playwright's **fixture graph**, per test, **wherever the `test` object
is used** — independent of file scope or import order. That is exactly the property we need, so
the reporting logic is a fixture, not a hook:

```ts
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ...other fixtures...

  _report: [
    async ({ db, config }, use) => {
      //  ⬆️ code here would run BEFORE the test (like beforeEach)
      await use() //          ⬅️ THE TEST RUNS AT THIS LINE
      //  ⬇️ code here runs AFTER the test (like afterEach)
      const testInfo = test.info()
      const testResult = buildTestResult(testInfo, config.TARGET_ENV, buildId)
      await reportTestResult(testResult) // Allure — always
      if (db) {
        const repo = new TestResultsRepository(db)
        await repo.insert(testResult) // Postgres — optional
        if (testInfo.status !== 'passed') {
          await runAiFailureAnalysis(testInfo, repo, buildId) // AI review — on failure
        }
      }
    },
    { auto: true },
  ],
})
```

### Anatomy

- **`await use()`** splits the fixture into setup (before) and teardown (after). We only use the
  teardown half, so it behaves as an "after each test" — but a graph-scoped one.
- **`use()` with no argument** — this fixture hands nothing to the test; its value type is
  `void`. It exists purely for the side effect after `use()`.
- **`test.info()`** retrieves the current `TestInfo` inside the fixture (fixtures don't receive
  it as a parameter). Its `.status` is final by teardown time.
- **`{ auto: true }`** is the key. Normally a fixture only runs if a test **asks for it** by
  name (`async ({ bvnkApi }) => …`). No test ever destructures `_report`, so without `auto` it
  would **never run**. `auto: true` means **"run for every test, whether or not anyone asks."**
  That is what turns it into a universal per-test hook.
- The **`[fn, { auto: true }]` array form** is how a fixture is declared with options (`auto`,
  `scope`, `timeout`) instead of just a bare function.

### Why this is the framework-sanctioned choice, not a workaround

Playwright's guidance is that hooks belong **in the spec file** (or a `describe` block). Anything
cross-cutting that must apply to **all** files — tracing, reporting, teardown — belongs in a
**fixture**, precisely because fixtures escape file scope. Our result recording is cross-cutting
by definition, so an auto fixture is the correct tool.

## Guardrail

The dashboard's **"Tests (last run)"** panel is the regression alarm for this exact class of bug:
if per-test recording ever silently drops results again, the count falls below the suite size.
It should equal the number of tests in the suite on every run.

## Related

- [AI-assisted failure review](../ai/ai-assisted-failure-review.md) — what step 3 actually does
  with the failure context this fixture hands it.
- `src/api/fixtures/api.fixture.ts` — the implementation.
