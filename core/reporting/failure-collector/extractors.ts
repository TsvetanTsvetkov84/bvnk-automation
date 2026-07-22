import AdmZip from 'adm-zip'

// ─── Trace event types ───────────────────────────────────────────────────────

type TraceLogEvent = {
  type: 'log'
  message: string
}

type TraceBeforeEvent = {
  type: 'before'
  callId: string
  class: string
  method: string
  params: Record<string, unknown>
}

type TraceAfterEvent = {
  type: 'after'
  callId: string
  error?: { message?: string }
  result?: { matches?: boolean }
}

type NetworkEvent = {
  type: 'resource-snapshot'
  snapshot: {
    request: { url: string; method: string }
    response: { status: number }
  }
}

type ScreencastFrame = {
  type: 'screencast-frame'
  sha1: string
  timestamp: number
}

export type FailedAction = {
  readonly method: string
  readonly params: Record<string, unknown>
  readonly error?: string
}

export type TraceEvent =
  | TraceLogEvent
  | TraceBeforeEvent
  | TraceAfterEvent
  | NetworkEvent
  | ScreencastFrame
  | { type: string }

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_LOG_LINES = 50

// ─── Extraction helpers ───────────────────────────────────────────────────────

/** Returns the last {@link MAX_LOG_LINES} console log messages from trace events. */
export function extractConsoleLogs(events: TraceEvent[]): string[] {
  return events
    .filter((e): e is TraceLogEvent => e.type === 'log')
    .map((e) => e.message)
    .slice(-MAX_LOG_LINES)
}

/** Extracts network requests with HTTP status >= 400 as formatted strings. */
export function extractNetworkErrors(events: TraceEvent[]): string[] {
  return events
    .filter((e): e is NetworkEvent => e.type === 'resource-snapshot')
    .filter((e) => e.snapshot.response.status >= 400)
    .map(
      (e) =>
        `${e.snapshot.request.method} ${e.snapshot.request.url} → HTTP ${e.snapshot.response.status}`
    )
}

/** Correlates before/after trace events by callId to identify Playwright actions that errored or had failed assertions. */
export function extractFailedActions(events: TraceEvent[]): FailedAction[] {
  const beforeMap = new Map<string, TraceBeforeEvent>()

  for (const e of events) {
    if (e.type === 'before') {
      const before = e as TraceBeforeEvent
      beforeMap.set(before.callId, before)
    }
  }

  const failed: FailedAction[] = []

  for (const e of events) {
    if (e.type !== 'after') continue
    const after = e as TraceAfterEvent
    const isFailure = after.error !== undefined || after.result?.matches === false
    if (!isFailure) continue

    const before = beforeMap.get(after.callId)
    if (!before) continue

    const action: FailedAction = {
      method: `${before.class}.${before.method}`,
      params: before.params,
      ...(after.error?.message !== undefined && { error: after.error.message }),
    }
    failed.push(action)
  }

  return failed
}

/** Extracts the last screencast frame from the trace zip as a base64 string. Falls back to the last JPEG resource if no screencast frames exist. */
export function extractLastScreenshot(zip: AdmZip, traceEvents: TraceEvent[]): string | undefined {
  const frames = traceEvents
    .filter((e): e is ScreencastFrame => e.type === 'screencast-frame')
    .sort((a, b) => b.timestamp - a.timestamp)

  for (const frame of frames) {
    const entry = zip
      .getEntries()
      .find((e) => e.entryName.includes('resources/') && e.entryName.includes(frame.sha1))
    if (entry) {
      return entry.getData().toString('base64')
    }
  }

  // Fallback: pick the last JPEG resource if no screencast-frame entries
  const jpegEntry = zip
    .getEntries()
    .filter((e) => e.entryName.endsWith('.jpeg') || e.entryName.endsWith('.jpg'))
    .at(-1)

  return jpegEntry?.getData().toString('base64')
}
