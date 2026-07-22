## ESLint Rules

### Ignored Paths

`node_modules/`, `out/`, `dist/`, `.eslintrc.cjs`, and `eslint.config.js` are excluded from linting.

### Extends

- `eslint:recommended` — ESLint's core recommended ruleset
- `plugin:@typescript-eslint/recommended` — TypeScript-specific recommended rules

  ***

### General Best Practices

| Rule           | Level | Notes                                           |
| -------------- | ----- | ----------------------------------------------- |
| `no-var`       | error | Use `let` or `const` instead of `var`           |
| `prefer-const` | error | Use `const` when a variable is never reassigned |

---

### TypeScript Rules

| Rule                                                | Level                  | Notes                                                                                                                      |
| --------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-unused-vars`                 | error                  | Unused variables are not allowed; prefix with `_` to suppress (e.g. `_unused`)                                             |
| `@typescript-eslint/return-await`                   | error (`in-try-catch`) | Avoid redundant `await` on return, **except** inside `try/catch` blocks where it's required to properly catch errors       |
| `@typescript-eslint/explicit-module-boundary-types` | off                    | Return types on exported functions are not enforced                                                                        |
| `@typescript-eslint/prefer-readonly`                | warn                   | Class properties that are never reassigned should be marked `readonly`                                                     |
| `@typescript-eslint/no-floating-promises`           | error                  | All Promises must be `await`ed or explicitly handled — prevents forgotten async calls (especially relevant for Playwright) |

#### `return-await` example

```ts
// BAD — redundant await
async function getUser() {
  return await fetchUser()
}

// GOOD — no await needed on plain return
async function getUser() {
  return fetchUser()
}

// GOOD — await required inside try/catch to catch rejections
async function getUser() {
  try {
    return await fetchUser()
  } catch (e) {
    logger.error(e)
  }
}
```

---

Import Rules (ESM / NodeNext)

```
  ┌────────────────────────┬───────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          Rule          │ Level │                                                Notes                                                 │
  ├────────────────────────┼───────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ import-x/no-unresolved │ error │ All imports must resolve to an existing module                                                       │
  ├────────────────────────┼───────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ import-x/extensions    │ error │ Relative .js imports must include the extension; .ts imports must omit it (TypeScript resolves them) │
  └────────────────────────┴───────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

Style Rules

```
  ┌──────────┬───────┬───────────────────────────────┐
  │   Rule   │ Level │             Notes             │
  ├──────────┼───────┼───────────────────────────────┤
  │ semi     │ error │ No semicolons                 │
  ├──────────┼───────┼───────────────────────────────┤
  │ eol-last │ error │ Files must end with a newline │
  └──────────┴───────┴───────────────────────────────┘
```

---

Environment & Config

```
  ┌────────────────────────────────────────┬───────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                  Rule                  │ Level │                                                         Notes                                                          │
  ├────────────────────────────────────────┼───────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ no-restricted-properties (process.env) │ error │ Direct access to process.env is forbidden — use getConfig() from core/config/config for centralized env var management │
  └────────────────────────────────────────┴───────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

File-Specific Overrides

````
  ┌─────────────────────────────────────────────────────┬───────────────────────┬────────────────────────────────────────────────────────────────────┐
  │                       Pattern                       │     Rule Override     │                               Reason                               │
  ├─────────────────────────────────────────────────────┼───────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ **/fixtures/**/*.ts, **/*fixture*.ts, **/*setup*.ts │ no-empty-pattern: off │ Playwright fixtures use empty destructuring patterns by convention │
  ├─────────────────────────────────────────────────────┼───────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ **/*.spec.ts                                        │ no-console: off       │ Console logging is allowed in test files                           │
  ├─────────────────────────────────────────────────────┼───────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ ```                                                 │                       │                                                                    │
  └─────────────────────────────────────────────────────┴───────────────────────┴────────────────────────────────────────────────────────────────────┘
````
