import type { AsyncJobAck, JobRecord } from "@/types/job";
import { AsyncJobError, AsyncJobTimeoutError } from "./async-job-error";
import { pollJob } from "./poll";

export interface EnqueueAndConfirmOptions {
  initialIntervalMs?: number;
  maxIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface EnqueuedWriteResult<TResult> {
  ack: AsyncJobAck;
  job: JobRecord<TResult>;
  result: TResult;
}

/**
 * Run a queued-write request end-to-end: send it, read the 202 ack, poll the
 * job, and return the authoritative result.
 *
 * Throws `AsyncJobError` on `failed`, `AsyncJobTimeoutError` if the poll
 * window elapses while the job is still `queued` / `processing`. Any network
 * or auth error inside the enqueue call propagates unchanged.
 *
 * Usage:
 * ```ts
 * const { ack, result } = await enqueueAndConfirm(
 *   () => apiPost<AsyncJobAck>("/departments", body),
 * );
 * ```
 */
export async function enqueueAndConfirm<TResult>(
  enqueue: () => Promise<AsyncJobAck>,
  options: EnqueueAndConfirmOptions = {},
): Promise<EnqueuedWriteResult<TResult>> {
  const ack = await enqueue();

  const job = await pollJob<TResult>(ack.jobId, options);

  if (job.status === "failed") {
    throw new AsyncJobError<TResult>(ack, job);
  }

  if (job.status !== "succeeded") {
    // Timed out. Caller decides whether to leave the UI in `_pending`.
    throw new AsyncJobTimeoutError<TResult>(ack, job);
  }

  return {
    ack,
    job,
    result: (job.result ?? (undefined as unknown)) as TResult,
  };
}
