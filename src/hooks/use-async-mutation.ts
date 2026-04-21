"use client";

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import type { AsyncJobAck, JobRecord } from "@/types/job";
import { enqueueAndConfirm, type EnqueueAndConfirmOptions } from "@/lib/jobs/enqueue";

/**
 * Context handed to the mutation callbacks so the caller can thread their own
 * rollback state through the optimistic → poll → merge pipeline without
 * monkey-patching React Query types.
 */
export interface AsyncMutationContext<TRollback> {
  /** Whatever `onOptimistic` returned. Usually the pre-update row for rollback. */
  rollback: TRollback | null;
}

export interface AsyncMutationResultData<TResult> {
  ack: AsyncJobAck;
  job: JobRecord<TResult>;
  result: TResult;
}

export interface UseAsyncMutationOptions<
  TInput,
  TResult,
  TRollback = unknown,
> extends Omit<
    UseMutationOptions<
      AsyncMutationResultData<TResult>,
      Error,
      TInput,
      AsyncMutationContext<TRollback>
    >,
    "mutationFn" | "onMutate" | "onSuccess" | "onError"
  > {
  /**
   * The enqueue step. Must return the 202 ack; the helper will unwrap the
   * envelope (interceptors already do) and then poll the job.
   */
  mutationFn: (input: TInput) => Promise<AsyncJobAck>;

  /**
   * Apply an optimistic cache update BEFORE the request goes out. Whatever
   * you return becomes the `rollback` context passed to `onFailure`.
   */
  onOptimistic?: (input: TInput) => TRollback | Promise<TRollback> | void;

  /**
   * Fired when the job reaches `succeeded`. Use this to merge the
   * authoritative `result` back into the cache and clear the `_pending` flag.
   */
  onSuccess?: (
    data: AsyncMutationResultData<TResult>,
    input: TInput,
    context: AsyncMutationContext<TRollback>,
  ) => void | Promise<void>;

  /**
   * Fired on enqueue error, `failed` job, or poll timeout. Use this to roll
   * back the optimistic update (or, for timeout, leave it in `_pending`).
   */
  onFailure?: (
    error: Error,
    input: TInput,
    context: AsyncMutationContext<TRollback>,
  ) => void | Promise<void>;

  /** Overrides for the poll backoff / timeout (see `pollJob`). */
  pollOptions?: EnqueueAndConfirmOptions;
}

/**
 * Thin wrapper over React Query's `useMutation` that bakes in the
 * enqueue → 202 ack → poll-job → result pipeline used by every queued
 * write on this backend.
 *
 * The caller still owns optimistic cache updates and rollbacks — this hook
 * just ensures the `mutationFn` resolves with the final resource (not the
 * ack) and that `onFailure` runs for both synchronous enqueue errors AND
 * job `failed` statuses.
 */
export function useAsyncMutation<TInput, TResult, TRollback = unknown>(
  options: UseAsyncMutationOptions<TInput, TResult, TRollback>,
) {
  const {
    mutationFn,
    onOptimistic,
    onSuccess,
    onFailure,
    pollOptions,
    ...rest
  } = options;

  return useMutation<
    AsyncMutationResultData<TResult>,
    Error,
    TInput,
    AsyncMutationContext<TRollback>
  >({
    ...rest,
    mutationFn: (input) =>
      enqueueAndConfirm<TResult>(() => mutationFn(input), pollOptions),
    onMutate: async (input) => {
      const rollback = onOptimistic ? await onOptimistic(input) : null;
      return { rollback: (rollback ?? null) as TRollback | null };
    },
    onSuccess: async (data, input, context) => {
      if (!context) return;
      await onSuccess?.(data, input, context);
    },
    onError: async (error, input, context) => {
      if (!context) return;
      await onFailure?.(error, input, context);
    },
  });
}
