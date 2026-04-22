import apiClient from "@/lib/api/client";
import type { JobRecord } from "@/types/job";

export const JOB_POLL_START_MS = 250;
export const JOB_POLL_MAX_MS = 2_000;
export const JOB_POLL_TIMEOUT_MS = 30_000;
const JOB_POLL_BACKOFF_FACTOR = 1.5;

export interface PollJobOptions {
  initialIntervalMs?: number;
  maxIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * One-shot, Promise-based job poller. Lives outside `use-job-polling` so it
 * can be imported by the axios layer without a circular dependency and
 * without pulling in `"use client"` boundaries.
 *
 * Resolves when the job reaches a terminal state (`succeeded` / `failed`);
 * on timeout, resolves with the last-seen (non-terminal) row so callers can
 * decide how to handle it.
 */
export async function pollJob<TResult = unknown>(
  jobId: string,
  options: PollJobOptions = {},
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

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Job polling aborted", "AbortError");
    }

    const response = await apiClient.get<JobRecord<TResult>>(`/jobs/${jobId}`);
    last = response.data;
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
