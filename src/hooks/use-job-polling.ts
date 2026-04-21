"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { JobRecord } from "@/types/job";

// Per the backend integration guide: start tight so UI "confirms" quickly,
// cap so we don't hammer the endpoint during slow runs.
export const JOB_POLL_START_MS = 250;
export const JOB_POLL_MAX_MS = 2_000;
export const JOB_POLL_TIMEOUT_MS = 30_000;
const JOB_POLL_BACKOFF_FACTOR = 1.5;

interface UseJobPollingOptions<TResult> {
  /** Override the initial poll delay. Defaults to 250ms. */
  initialIntervalMs?: number;
  /** Cap for the delay between polls. Defaults to 2s. */
  maxIntervalMs?: number;
  /**
   * How long to keep polling before giving up and deferring to the failure
   * notification. Defaults to 30s. Never treat a timeout as "failure" — the
   * worker may still be running.
   */
  timeoutMs?: number;
  /** Fired exactly once when the job transitions to `succeeded` or `failed`. */
  onSettled?: (job: JobRecord<TResult>) => void;
  /** Fired exactly once when polling hits the timeout. */
  onTimeout?: () => void;
}

/**
 * Poll `GET /v1/jobs/{jobId}` until the job reaches a terminal state
 * (`succeeded` or `failed`).
 *
 * Backoff is exponential with a cap: start at 250ms and grow by 1.5× up to
 * 2s. Total wait caps at 30s — after that the caller should fall back to
 * "Saving…" UI and rely on the failure notification to close the loop.
 *
 * Callers typically render a "saving…" indicator while `isActive` is true and
 * surface `parseJobError(job)` on failure.
 */
export function useJobPolling<TResult = unknown>(
  jobId: string | null | undefined,
  options: UseJobPollingOptions<TResult> = {},
) {
  const {
    initialIntervalMs = JOB_POLL_START_MS,
    maxIntervalMs = JOB_POLL_MAX_MS,
    timeoutMs = JOB_POLL_TIMEOUT_MS,
    onSettled,
    onTimeout,
  } = options;

  const settledFiredRef = useRef<string | null>(null);
  const timeoutFiredRef = useRef<string | null>(null);
  const startedAtRef = useRef<{ id: string; at: number } | null>(null);
  const delayRef = useRef<number>(initialIntervalMs);

  // Reset per-jobId state whenever the id changes.
  useMemo(() => {
    if (!jobId) return;
    if (startedAtRef.current?.id !== jobId) {
      startedAtRef.current = { id: jobId, at: Date.now() };
      delayRef.current = initialIntervalMs;
    }
  }, [jobId, initialIntervalMs]);

  const query = useQuery<JobRecord<TResult>>({
    queryKey: ["jobs", jobId],
    queryFn: () => apiGet<JobRecord<TResult>>(`/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "succeeded" || status === "failed") return false;

      const started = startedAtRef.current;
      if (started && started.id === jobId) {
        const elapsed = Date.now() - started.at;
        if (elapsed > timeoutMs) return false;
      }

      const next = delayRef.current;
      delayRef.current = Math.min(next * JOB_POLL_BACKOFF_FACTOR, maxIntervalMs);
      return next;
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 30_000,
    // Each call is cheap; if the network blinks, retry rather than fail.
    retry: 2,
  });

  const status = query.data?.status;
  const started = startedAtRef.current;
  const elapsed =
    started && started.id === jobId ? Date.now() - started.at : 0;
  const isTerminal = status === "succeeded" || status === "failed";
  const isTimedOut = !!jobId && !isTerminal && elapsed > timeoutMs;
  const isActive =
    !!jobId &&
    !isTimedOut &&
    (status === "queued" ||
      status === "processing" ||
      (!status && query.isFetching));
  const isSucceeded = status === "succeeded";
  const isFailed = status === "failed";

  // Fire onSettled exactly once per jobId.
  useEffect(() => {
    if (!jobId || !onSettled || !query.data) return;
    if (!isTerminal) return;
    if (settledFiredRef.current === jobId) return;
    settledFiredRef.current = jobId;
    onSettled(query.data);
  }, [jobId, isTerminal, query.data, onSettled]);

  // Fire onTimeout exactly once per jobId.
  useEffect(() => {
    if (!jobId || !onTimeout) return;
    if (!isTimedOut) return;
    if (timeoutFiredRef.current === jobId) return;
    timeoutFiredRef.current = jobId;
    onTimeout();
  }, [jobId, isTimedOut, onTimeout]);

  return {
    job: query.data,
    status,
    isActive,
    isSucceeded,
    isFailed,
    isTimedOut,
    error: query.data?.error ?? null,
    result: (query.data?.result as TResult | null | undefined) ?? null,
    refetch: query.refetch,
  };
}

/**
 * One-shot, Promise-based variant of `useJobPolling` for use outside React
 * (e.g. inside a mutation's `onSuccess`). Resolves when the job reaches a
 * terminal state; on timeout, resolves with the last-seen (non-terminal) row
 * so callers can decide how to handle it.
 */
export async function pollJob<TResult = unknown>(
  jobId: string,
  options: {
    initialIntervalMs?: number;
    maxIntervalMs?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<JobRecord<TResult>> {
  const {
    initialIntervalMs = JOB_POLL_START_MS,
    maxIntervalMs = JOB_POLL_MAX_MS,
    timeoutMs = JOB_POLL_TIMEOUT_MS,
    signal,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let delay = initialIntervalMs;
  let last: JobRecord<TResult> | null = null;

  // Loop at least once so we always get a fresh row back.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Job polling aborted", "AbortError");
    }

    last = await apiGet<JobRecord<TResult>>(`/jobs/${jobId}`);
    if (last.status === "succeeded" || last.status === "failed") return last;

    if (Date.now() >= deadline) return last;

    await sleep(delay, signal);
    delay = Math.min(delay * JOB_POLL_BACKOFF_FACTOR, maxIntervalMs);
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Job polling aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Job polling aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
