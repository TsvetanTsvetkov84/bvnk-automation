export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type QueryParameters = Readonly<Record<string, string | number | boolean | null | undefined>>

export interface HttpRequestOptions {
  readonly headers?: Record<string, string>
  readonly query?: QueryParameters
  readonly timeoutMs?: number
}

export interface HttpRequest<TBody> extends HttpRequestOptions {
  readonly url?: string
  readonly method?: HttpMethod
  readonly body?: TBody
}

export interface HttpResponse<TData> {
  readonly status: number
  readonly headers: unknown
  readonly data: TData
}

/**
 * Transport-agnostic HTTP client contract.
 *
 * Non-2xx responses are returned, not thrown — consumers assert on `status`.
 * Only network/client failures throw ({@link HttpError}).
 */
export interface HttpClient {
  /** Generic escape hatch: full control over method, url, body, and options via {@link HttpRequest}. */
  request<TResponse, TBody = undefined>(req: HttpRequest<TBody>): Promise<HttpResponse<TResponse>>

  /** GET `url`. `options`: per-request headers, query params, timeout. */
  get<TResponse>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<TResponse>>

  /** POST `body` (JSON) to `url`. `options`: per-request headers, query params, timeout. */
  post<TResponse, TBody>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>>

  /** PUT `body` (JSON) to `url`. `options`: per-request headers, query params, timeout. */
  put<TResponse, TBody>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>>

  /** PATCH `body` (JSON) to `url`. `options`: per-request headers, query params, timeout. */
  patch<TResponse, TBody>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>>

  /** DELETE `url`. `options`: per-request headers, query params, timeout. */
  delete<TResponse>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<TResponse>>
}

export interface HttpErrorDetails {
  readonly status?: number
  readonly url?: string | undefined
  readonly method?: HttpMethod | undefined
  readonly responseBody?: unknown
  readonly isNetworkError?: boolean
}

export class HttpError extends Error {
  public readonly details: HttpErrorDetails
  public override readonly cause: unknown

  public constructor(message: string, details: HttpErrorDetails, cause: unknown) {
    super(message)
    this.name = 'HttpError'
    this.details = details
    this.cause = cause
  }
}

/**
 * Auth strategy: receives the outgoing request, returns headers to merge.
 * Return `null` to skip auth for a given request.
 */
export type AuthHeadersProvider = (
  req: Readonly<HttpRequest<unknown>>
) => Promise<Readonly<Record<string, string>> | null> | Readonly<Record<string, string>> | null
