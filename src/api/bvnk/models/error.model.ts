/** FastAPI error body with a plain-string detail (business errors: 400/401/404/412). */
export type ApiErrorResponse = {
  readonly detail: string
}

/** One entry of a FastAPI 422 validation error. */
export type ValidationErrorDetail = {
  readonly type: string
  readonly loc: readonly (string | number)[]
  readonly msg: string
  readonly input?: unknown
}

/** FastAPI 422 body — `detail` is an array of structured validation errors. */
export type ValidationErrorResponse = {
  readonly detail: readonly ValidationErrorDetail[]
}
