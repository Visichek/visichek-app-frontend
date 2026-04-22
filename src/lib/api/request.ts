import apiClient from "./client";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import type { AsyncJobAck } from "@/types/job";
import { AsyncJobError, AsyncJobTimeoutError } from "@/lib/jobs/async-job-error";
import { pollJob, type PollJobOptions } from "@/lib/jobs/poll";

/**
 * How the axios helpers should react to a `202 Accepted` queued-write ack.
 *
 * - `"auto-poll"` (default): poll `GET /v1/jobs/{jobId}` to a terminal state
 *   and resolve with the job's `result`. This keeps the caller's
 *   `mutation.isPending` / awaited promise alive for the full enqueue →
 *   succeeded/failed lifecycle, so buttons stay disabled until the worker
 *   actually settles. Throws `AsyncJobError` on `failed` and
 *   `AsyncJobTimeoutError` on poll timeout.
 * - `"raw"`: return the `AsyncJobAck` verbatim. Use only when you need the
 *   pre-assigned resource id for optimistic routing before the worker
 *   finishes, and you plan to poll yourself (see `enqueueAndConfirm`).
 */
export type AsyncJobMode = "auto-poll" | "raw";

export interface RequestConfig extends AxiosRequestConfig {
  asyncJob?: AsyncJobMode;
  pollOptions?: PollJobOptions;
}

function looksLikeAsyncJobAck(data: unknown): data is AsyncJobAck {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.jobId === "string" &&
    typeof candidate.status === "string"
  );
}

/**
 * Resolve a response that may be a 202 queued-write ack. For 2xx-non-202 or
 * `asyncJob: "raw"`, returns the unwrapped body as-is. For 202 with an ack
 * shape, polls the job and returns its `result` on success.
 */
async function resolveResponse<T>(
  response: AxiosResponse,
  config?: RequestConfig,
): Promise<T> {
  if (config?.asyncJob === "raw") return response.data as T;
  if (response.status !== 202) return response.data as T;
  if (!looksLikeAsyncJobAck(response.data)) return response.data as T;

  const ack = response.data as AsyncJobAck;
  const job = await pollJob<T>(ack.jobId, config?.pollOptions);

  if (job.status === "failed") {
    throw new AsyncJobError<T>(ack, job);
  }
  if (job.status !== "succeeded") {
    throw new AsyncJobTimeoutError<T>(ack, job);
  }
  return (job.result ?? (undefined as unknown)) as T;
}

/**
 * Typed GET request. The response is already unwrapped by the interceptor.
 */
export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown> | object,
  config?: RequestConfig,
): Promise<T> {
  const response = await apiClient.get<T>(url, { ...config, params });
  return response.data;
}

/**
 * Typed POST request. Auto-polls 202 queued-write responses unless
 * `config.asyncJob === "raw"`.
 */
export async function apiPost<T>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<T> {
  const response = await apiClient.post(url, data, config);
  return resolveResponse<T>(response, config);
}

/**
 * Typed PUT request. Auto-polls 202 queued-write responses unless
 * `config.asyncJob === "raw"`.
 */
export async function apiPut<T>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<T> {
  const response = await apiClient.put(url, data, config);
  return resolveResponse<T>(response, config);
}

/**
 * Typed PATCH request. Auto-polls 202 queued-write responses unless
 * `config.asyncJob === "raw"`.
 */
export async function apiPatch<T>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<T> {
  const response = await apiClient.patch(url, data, config);
  return resolveResponse<T>(response, config);
}

/**
 * Typed DELETE request. Auto-polls 202 queued-write responses unless
 * `config.asyncJob === "raw"`.
 */
export async function apiDelete<T>(
  url: string,
  config?: RequestConfig,
): Promise<T> {
  const response = await apiClient.delete(url, config);
  return resolveResponse<T>(response, config);
}
