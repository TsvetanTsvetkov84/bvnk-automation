import type { HttpClient, HttpResponse } from '../../../../core/api/http.client.js'
import type { EchoResponse, HealthMetrics, InitResponse } from '../models/auth.model.js'

/** Client for the unauthenticated + auth-verification endpoints of the BVNK simulator. */
export class AuthClient {
  /** @param http - HTTP transport (auth strategy already attached). */
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /init` — creates a fresh simulated account with default balances.
   *
   * @returns Response with a bearer token (24h validity) and its expiry timestamp.
   */
  async init(): Promise<HttpResponse<InitResponse>> {
    return this.http.get<InitResponse>('/init')
  }

  /**
   * `POST /echo` — verifies authentication.
   *
   * @param body - Any payload; echoed back by the endpoint.
   * @returns Response with token expiry time and the echoed payload.
   */
  async echo<TBody>(body: TBody): Promise<HttpResponse<EchoResponse>> {
    return this.http.post<EchoResponse, TBody>('/echo', body)
  }

  /**
   * `GET /health` — simulator health metrics.
   *
   * @returns Response with uptime, DB size, and request counters.
   */
  async health(): Promise<HttpResponse<HealthMetrics>> {
    return this.http.get<HealthMetrics>('/health')
  }
}
