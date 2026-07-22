/**
 * getConfig generic function to provide various configs needed
 */
import type * as z from 'zod'

type AnySchema = z.ZodTypeAny

export function getConfig<TSchema extends AnySchema>(schema: TSchema): Readonly<z.infer<TSchema>> {
  const processEnv = {
    // eslint-disable-next-line no-restricted-properties
    ...process.env,
  }

  return schema.parse(processEnv)
}
