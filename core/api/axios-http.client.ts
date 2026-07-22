import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type CreateAxiosDefaults,
} from 'axios'
import {
  type AuthHeadersProvider,
  type HttpClient,
  HttpError,
  type HttpRequest,
  type HttpRequestOptions,
  type HttpResponse,
} from './http.client.js'

export interface AxiosHttpClientOptions {
  readonly baseUrl: string
  readonly defaultHeaders?: Readonly<Record<string, string>>
  readonly defaultTimeoutMs?: number

  /**
   * Optional auth strategy. Receives each outgoing request,
   * returns headers to merge — or null to skip auth.
   */
  readonly authProvider?: AuthHeadersProvider
}

/**
 * Axios implementation of {@link HttpClient}.
 *
 * Creates a dedicated Axios instance with instance-level defaults
 * (baseURL, headers, timeout) so that per-request config is cleanly
 * merged on top following Axios's config precedence order:
 *   library defaults → instance defaults → request config.
 *
 * * @see ./README.md (`core/api/README.md`) for usage examples and architecture overview.
 * @see https://axios-http.com/docs/instance
 * @see https://axios-http.com/docs/config_defaults
 */
export class AxiosHttpClient implements HttpClient {
  private readonly instance: AxiosInstance
  private readonly options: AxiosHttpClientOptions

  /** @param options - Base URL, default headers/timeout, and optional {@link AuthHeadersProvider}. */
  /** @param options - Base URL, optional default headers/timeout, and optional auth strategy. */
  public constructor(options: AxiosHttpClientOptions) {
    this.options = options

    const config: CreateAxiosDefaults = { baseURL: options.baseUrl }
    if (options.defaultHeaders) config.headers = options.defaultHeaders
    if (options.defaultTimeoutMs !== undefined) config.timeout = options.defaultTimeoutMs

    this.instance = axios.create(config)
  }

  /**
   * Executes a request: resolves auth headers, merges config, never throws on non-2xx status.
   *
   * @param req - Method, url, body, and per-request options. Header precedence:
   *   per-request > auth provider > instance defaults.
   * @throws HttpError only on network/client failure (no response received).
   */
  public async request<TResponse, TBody = undefined>(
    req: HttpRequest<TBody>
  ): Promise<HttpResponse<TResponse>> {
    const authHeaders: Readonly<Record<string, string>> | null =
      (await this.options.authProvider?.(req)) ?? null

    const config: AxiosRequestConfig = {
      headers: {
        ...(authHeaders ?? undefined),
        ...req.headers,
      },
      responseType: 'json',
      validateStatus: () => true, // Axios throws on non-2xx by default. We suppress this so that we can process the responses as we wish.
    }

    if (req.url) config.url = req.url
    if (req.method) config.method = req.method
    if (req.query) config.params = req.query
    if (req.body !== undefined) config.data = req.body

    const timeout = req.timeoutMs ?? this.options.defaultTimeoutMs
    if (timeout !== undefined) config.timeout = timeout

    let res: AxiosResponse<TResponse>
    try {
      res = await this.instance.request<TResponse>(config)
    } catch (cause: unknown) {
      throw new HttpError(
        'HTTP request failed (network/client)',
        { url: req.url, method: req.method, isNetworkError: true },
        cause
      )
    }

    return {
      status: res.status,
      headers: res.headers,
      data: res.data,
    }
  }

  /** GET `url`. Delegates to {@link request}. */
  public async get<TResponse>(
    url: string,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse>({ method: 'GET', url, ...options })
  }

  /** POST `body` to `url`. Delegates to {@link request}. */
  public async post<TResponse, TBody>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: 'POST',
      url,
      body,
      ...options,
    })
  }

  /** PUT `body` to `url`. Delegates to {@link request}. */
  public async put<TResponse, TBody>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: 'PUT',
      url,
      body,
      ...options,
    })
  }

  /** PATCH `body` to `url`. Delegates to {@link request}. */
  public async patch<TResponse, TBody>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: 'PATCH',
      url,
      body,
      ...options,
    })
  }

  /** DELETE `url`. Delegates to {@link request}. */
  public async delete<TResponse>(
    url: string,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse>({ method: 'DELETE', url, ...options })
  }
}
