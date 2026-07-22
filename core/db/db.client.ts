export interface QueryResult<T> {
  rows: T[]
  rowCount: number
}

export interface QueryConfig {
  sql: string
  params?: readonly unknown[]
}

export interface DatabaseClient {
  query<T = unknown>(config: QueryConfig): Promise<QueryResult<T>>
  close(): Promise<void>
}
