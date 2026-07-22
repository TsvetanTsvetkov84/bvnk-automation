export async function waitFor<T>(
  fn: () => Promise<T>,
  isSuccess: (value: T) => boolean,
  timeoutMs = 15000,
  intervalMs = 300
): Promise<T> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = await fn()

    if (isSuccess(value)) {
      return value
    }

    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error('Timeout waiting for condition')
}
