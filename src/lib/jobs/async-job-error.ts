import type { AsyncJobAck, JobRecord } from "@/types/job";
import { parseJobError } from "./parse-error";

/**
 * Thrown when a queued write reports `status: "failed"` on its job log.
 *
 * Wraps both the original 202 ack and the terminal job row so UI can route
 * the user to `/app/jobs/:taskId` for more context. The `message` is the
 * user-safe summary (`parseJobError(job)`), not the raw string.
 */
export class AsyncJobError<TResult = unknown> extends Error {
  readonly ack: AsyncJobAck;
  readonly job: JobRecord<TResult>;

  constructor(ack: AsyncJobAck, job: JobRecord<TResult>) {
    super(parseJobError(job));
    this.name = "AsyncJobError";
    this.ack = ack;
    this.job = job;
  }

  get jobId(): string {
    return this.ack.jobId;
  }

  get resourceId(): string {
    return this.ack.id;
  }
}

/**
 * Thrown when polling exceeds its timeout without the job reaching a terminal
 * state. The writer may still succeed later — the failure notification is the
 * safety net. UI should keep the row in `_pending` / `_stuck` state rather
 * than rolling it back.
 */
export class AsyncJobTimeoutError<TResult = unknown> extends Error {
  readonly ack: AsyncJobAck;
  readonly lastKnownJob: JobRecord<TResult> | null;

  constructor(ack: AsyncJobAck, lastKnownJob: JobRecord<TResult> | null) {
    super(
      `Still saving… this is taking longer than usual. We'll notify you if it fails.`,
    );
    this.name = "AsyncJobTimeoutError";
    this.ack = ack;
    this.lastKnownJob = lastKnownJob;
  }

  get jobId(): string {
    return this.ack.jobId;
  }

  get resourceId(): string {
    return this.ack.id;
  }
}

export function isAsyncJobError(err: unknown): err is AsyncJobError {
  return err instanceof AsyncJobError;
}

export function isAsyncJobTimeoutError(
  err: unknown,
): err is AsyncJobTimeoutError {
  return err instanceof AsyncJobTimeoutError;
}
