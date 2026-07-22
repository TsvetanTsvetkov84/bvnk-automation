# Summary

## Running tests - Flow examples

```
yarn test:api
│
├─ tsx scripts/cli/test.ts api
│    │
│    ├─ look up SUITES["api"]
│    │    → playwrightConfig: "configs/playwright.api.config.ts"
│    │
│    └─ spawn: playwright test --config=configs/playwright.api.config.ts
│         with env = process.env (+ .env via dotenv)
│
└─ Playwright reads config, getConfig(apiTestEnvSchema) validates env ✅
```

## Other CLI scripts

| Script                          | Purpose                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `scripts/cli/validate-names.ts` | Enforces kebab-case file/dir naming (`check:filenames`) |
