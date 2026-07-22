/** Response of `GET /init` — a fresh simulated account with default balances. */
export type InitResponse = {
  readonly access_token: string
  readonly token_type: string
  readonly expiry: number
}

/** Response of `POST /echo` — token expiry plus the echoed request body. */
export type EchoResponse = {
  readonly auth_token_expiry_time: string
  readonly request_payload: unknown
}

/** Response of `GET /health`. */
export type HealthMetrics = {
  readonly uptime: string
  readonly approximate_db_size: string
  readonly total_authenticated_requests: number
}
