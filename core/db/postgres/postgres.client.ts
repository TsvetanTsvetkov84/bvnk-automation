import { Pool } from 'pg'
import { DatabaseClient, QueryConfig, QueryResult } from '../db.client.js'

export class PostgresClient implements DatabaseClient {
  constructor(private readonly pool: Pool) {}

  async query<T>(config: QueryConfig): Promise<QueryResult<T>> {
    const params = config.params ? [...config.params] : []
    const result = await this.pool.query(config.sql, params)

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
