/**
 * Environment variable schemas.
 */
import * as z from 'zod'

/**
 * BASE schemas.
 *
 * Each schema defines a single concern.
 */
// ─── Base ───
export const baseEnvSchema = z.object({
  TARGET_ENV: z
    .preprocess((v) => String(v).toUpperCase(), z.enum(['LOCAL', 'CI']))
    .default('LOCAL'),
})
export type BaseEnvConfig = z.infer<typeof baseEnvSchema>

// ─── BVNK API simulator ───
export const bvnkEnvSchema = z.object({
  BVNK_BASE_URL: z.url().default('https://bvnkapisimulator.pythonanywhere.com'),
})
export type BvnkEnvConfig = z.infer<typeof bvnkEnvSchema>

// ─── Postgres connection (optional test-results persistence) ───
export const dbEnvSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
})
export type DbEnvConfig = z.infer<typeof dbEnvSchema>

// ─── Anthropic / Claude API (optional AI failure review) ───
export const anthropicEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
})
export type AnthropicEnvConfig = z.infer<typeof anthropicEnvSchema>

/**
 * COMBINED schemas.
 *
 * schema1.extends(schema2.shape)...extends(schemaN.shape) etc.
 */
export const apiTestEnvSchema = baseEnvSchema.extend(bvnkEnvSchema.shape)
export type ApiTestEnvConfig = z.infer<typeof apiTestEnvSchema>
