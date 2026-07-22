# tsconfig.js

Explanations about the rules
In addition to "strict": true, modern TypeScript codebases should enable the following options:

---

## exactOptionalPropertyTypes

Ensures optional properties behave exactly as defined.

This compiles even though name was meant to be optional, not explicitly undefined.

```ts
;`exactOptionalPropertyTypes: false`
interface User {
  name?: string
}
const user: User = { name: undefined } // compiles
```

```typescript
;`exactOptionalPropertyTypes: true`
const user: User = { name: undefined } //  =>  ❌ Error
```

---

## noUncheckedIndexedAccess

```typescript
;`noUncheckedIndexedAccess: false`
const users = ['Alice', 'Bob']
const user = users[5]
console.log(user.toUpperCase()) // compiles but crashes runtime
```

```typescript
;`noUncheckedIndexedAccess: true`
const users = ['Alice', 'Bob']
const user = users[5]
console.log(user.toUpperCase()) // ❌ Error

// Correct handling
if (user) {
  user.toUpperCase()
}
```

---

## noImplicitOverride

Requires the `override` keyword when overriding class methods.
This prevents silent bugs when a parent class method is renamed or removed.

```ts
;`noImplicitOverride: false`
class BaseRepository {
  save(entity: unknown) {
    console.log('Saving entity')
  }
}

class UserRepository extends BaseRepository {
  save(entity: unknown) {
    console.log('Saving user')
  }
}

// If someone later refactors the base class:
class BaseRepository {
  persist(entity: unknown) {}
}
// Now `UserRepository.save()` no longer overrides anything, but TypeScript will not warn you.
```

```ts
;`noImplicitOverride: true`
// Now if the parent method changes:
class BaseRepository {
  persist(entity: unknown) {}
}
// ❌ Error: Method 'save' does not override a method from the base class.
```

---

## noPropertyAccessFromIndexSignature

Prevents unsafe property access on objects with index signatures.

```typescript
;`noPropertyAccessFromIndexSignature: false`
interface Config {
  [key: string]: string
}

const config: Config = {}

config.port // compiles even though port may not exist
```

```typescript
;`noPropertyAccessFromIndexSignature: true`
config.port // ❌ Error
config['port'] // Correct usage. Forces devs to acknowledge the value may be missing.
```
