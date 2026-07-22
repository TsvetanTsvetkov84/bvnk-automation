import type { FailureAnalysis } from '../../ai/automatic-failure-review/parse-analysis.js'
import { DatabaseClient, QueryConfig } from '../db.client.js'

export interface TestResultBase {
  jiraId: string
  testName: string
  priority: string
  retry: number
  status: string
  duration: number
  buildId: string
  targetEnv: string
}

export type TestResultInsert = TestResultBase

export interface TestResultRow extends TestResultBase {
  id: number
  createdAt: Date
}

export class TestResultsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async insert(testResult: TestResultInsert) {
    const config: QueryConfig = {
      sql: 'INSERT INTO test_results (jira_id, test_name, priority, target_env, status, duration, retry, build_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      params: [
        testResult.jiraId,
        testResult.testName,
        testResult.priority,
        testResult.targetEnv,
        testResult.status,
        testResult.duration,
        testResult.retry,
        testResult.buildId,
      ],
    }

    return this.db.query(config)
  }

  async updateAiFields(analysis: FailureAnalysis, testName: string, buildId: string) {
    const config: QueryConfig = {
      sql: `UPDATE test_results
            SET ai_explanation       = $1,
                ai_classification    = $2,
                ai_suggested_action  = $3,
                ai_confidence        = $4
            WHERE id = (
              SELECT id FROM test_results
              WHERE test_name = $5 AND build_id = $6
              ORDER BY id DESC
              LIMIT 1
            )`,
      params: [
        analysis.explanation,
        analysis.classification,
        analysis.suggestedAction,
        analysis.confidence,
        testName,
        buildId,
      ],
    }

    return this.db.query(config)
  }
}
