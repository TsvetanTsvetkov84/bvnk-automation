# HTTP Client (`core/api`)

A standalone, transport-agnostic HTTP client abstraction with an Axios-backed implementation.

---

## Architecture

---

### Design Principles

| Principle                 | Application                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Single Responsibility** | `AxiosHttpClient` handles HTTP transport only; auth is delegated to an injected `AuthHeadersProvider` |
| **Open/Closed**           | New auth strategies are added as factory functions — no modification to the client class              |
| **Liskov Substitution**   | Any `HttpClient` implementation can be swapped transparently                                          |
| **Interface Segregation** | Consumers depend on the lean `HttpClient` interface, not Axios internals                              |
| **Dependency Inversion**  | All domain clients depend on `HttpClient`, never on Axios directly                                    |

### Auth Strategy (Strategy Pattern)

Auth is **not** embedded in the HTTP client. Instead, an optional `AuthHeadersProvider` function is injected via options. It receives the outgoing request and returns headers to merge — or `null` to skip auth.

```typescript
// Defined in http.client.ts
type AuthHeadersProvider = (
  req: Readonly<HttpRequest<unknown>>
) => Promise<Readonly<Record<string, string>> | null> | Readonly<Record<string, string>> | null
```

Pre-built factories in `auth-providers.ts`:

| Factory                            | Use Case                                               |
| ---------------------------------- | ------------------------------------------------------ |
| `bearerTokenAuth(getToken)`        | `Authorization: Bearer <token>`                        |
| `basicAuth(getCredentials)`        | `Authorization: Basic <base64>`                        |
| `staticHeaderAuth(name, getValue)` | Any single-header auth (API keys, custom tokens, etc.) |

For anything more complex (HMAC signing, multi-header schemes), pass a custom function directly.

---

## Usage Examples

### Basic Setup (No Auth)

```typescript
import { AxiosHttpClient } from './axios-http.client'
import type { HttpClient, HttpResponse } from './http.client'

const api: HttpClient = new AxiosHttpClient({
  baseUrl: 'https://api.example.com',
  defaultHeaders: { 'Content-Type': 'application/json' },
  defaultTimeoutMs: 10_000,
})
```

### Bearer Token Auth

```typescript
import { AxiosHttpClient } from './axios-http.client'
import { bearerTokenAuth } from './auth-providers'
import type { HttpClient } from './http.client'

const api: HttpClient = new AxiosHttpClient({
  baseUrl: 'https://api.example.com',
  defaultTimeoutMs: 10_000,
  authProvider: bearerTokenAuth(() => process.env.API_TOKEN ?? null),
})

interface User {
  readonly id: number
  readonly name: string
}

// GET
const users: HttpResponse<User[]> = await api.get<User[]>('/users')

// POST
const created: HttpResponse<User> = await api.post<User, { name: string }>('/users', {
  name: 'Alice',
})

// PUT
await api.put<User, { name: string }>('/users/1', { name: 'Alice Updated' })

// PATCH
await api.patch<User, { name: string }>('/users/1', { name: 'Bob' })

// DELETE
await api.delete<void>('/users/1')
```

### Basic Auth

```typescript
import { AxiosHttpClient } from './axios-http.client'
import { basicAuth } from './auth-providers'
import type { HttpClient } from './http.client'

const legacyApi: HttpClient = new AxiosHttpClient({
  baseUrl: 'https://old.example.com',
  authProvider: basicAuth(() => ({ user: 'admin', pass: 's3cret' })),
})

const data = await legacyApi.get<{ status: string }>('/health')
```

### Static Header Auth (API Key)

```typescript
import { AxiosHttpClient } from './axios-http.client'
import { staticHeaderAuth } from './auth-providers'
import type { HttpClient } from './http.client'

const apiKeyClient: HttpClient = new AxiosHttpClient({
  baseUrl: 'https://service.example.com',
  authProvider: staticHeaderAuth('X-Api-Key', () => process.env.SERVICE_API_KEY ?? null),
})
```

### Custom Auth (HMAC Signing)

For complex multi-header auth, pass a function directly — no factory needed

```typescript
import { AxiosHttpClient } from './axios-http.client'
import type { HttpClient } from './http.client'

const signedClient: HttpClient = new AxiosHttpClient({
  baseUrl: 'https://secure-api.example.com',
  authProvider: async (req) => ({
    'X-Api-Key': API_KEY,
    'X-Signature': computeHmac(req),
    'X-Timestamp': Date.now().toString(),
  }),
})

const order = await signedClient.post<OrderResponse, OrderPayload>('/orders', payload)
```

---

## Error Handling

All network/client errors are wrapped in `HttpError` with structured details:

**Important:** Non-2xx status codes are not thrown as errors. The response is returned normally so consumers can decide their own error-handling strategy based on response.status

```typescript
import { HttpError } from './http.client'

try {
  await api.get<User[]>('/users')
} catch (error: unknown) {
  if (error instanceof HttpError) {
    console.error(error.message) // 'HTTP request failed (network/client)'
    console.error(error.details.url) // '/users'
    console.error(error.details.method) // 'GET'
    console.error(error.details.isNetworkError) // true
    console.error(error.cause) // original Axios error
  }
}
```

---

## Per-Request Overrides

Every convenience method accepts optional overrides for headers, query params, and timeout:

```typescript
const res = await api.get<User[]>('/users', {
  headers: { 'X-Request-Id': 'abc-123' },
  query: { page: 1, limit: 20, active: true },
  timeoutMs: 30_000,
})
```

Per-request headers **always take precedence** over auth headers, which in turn override instance defaults — matching Axios's config merge order.

---
