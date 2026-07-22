export type RandomFailureOptions = {
  /**
   * Probability in the range [0..1].
   * 0 => never fails, 1 => always fails
   */
  readonly probability: number
  /** Optional label to help identify where the failure was injected. */
  readonly label?: string
  /**
   * Optional seed to make failures deterministic across runs.
   * Same seed + same call order => same outcomes.
   */
  readonly seed?: number
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Throws an Error randomly (or deterministically if seed is provided).
 */
export function simulateRandomFailure(options: RandomFailureOptions): void {
  const p = options.probability
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error(`simulateRandomFailure: probability must be in [0..1]. Got: ${String(p)}`)
  }

  const rand = options.seed === undefined ? Math.random : mulberry32(options.seed)
  if (rand() < p) {
    const suffix = options.label ? ` (${options.label})` : ''
    throw new Error(`Simulated random failure${suffix}`)
  }
}
