/**
 * Tiny module-level flag tracking whether the notifications SSE stream
 * (`GET /v1/notifications/stream`) is currently connected.
 *
 * It deliberately lives outside React state: the only reader is the
 * summary query's `refetchInterval` callback, which React Query
 * re-evaluates after each fetch. When the stream is connected we stop
 * polling (the stream pushes absolute state in real time); when it
 * drops, the stream hook invalidates the summary query, which forces a
 * refetch, re-evaluates this flag, and resumes polling as a fallback.
 *
 * Using a plain variable avoids threading a context through every
 * consumer of the summary query just to gate a timer.
 */
let connected = false;

export function setStreamConnected(value: boolean): void {
  connected = value;
}

export function isStreamConnected(): boolean {
  return connected;
}
