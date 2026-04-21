import type { JobStatus, SystemUserRole } from "./enums";

/**
 * Async ack returned by every queued-write endpoint (HTTP 202 Accepted).
 *
 * Shape:
 *   { id, jobId, status: "queued" }
 *
 * - `id` is the pre-assigned resource id for most writers, so the UI can route
 *   to `/resource/:id` immediately. A handful of writers (notably
 *   `subscription.create`) assign the real id inside the worker — in those
 *   cases, prefer `result.id` after polling.
 * - `jobId` is the celery task id; poll `GET /v1/jobs/{jobId}` for terminal
 *   status.
 * - `status` is always `"queued"` on this response.
 */
export interface AsyncJobAck {
  id: string;
  jobId: string;
  status: JobStatus;
}

/**
 * A single row from `GET /v1/jobs/{jobId}` (and the list endpoint).
 *
 * `error` is a short summary string (e.g. `"AppException: Department name
 * already exists"`) — strip the exception prefix with `parseJobError` before
 * showing to users. The richer `AppException.details` is NOT available here;
 * re-fetch the resource if you need it.
 *
 * Timestamp fields are Unix epoch seconds, matching the rest of the API.
 */
export interface JobRecord<TResult = unknown> {
  taskId: string;
  taskKey: string;
  resourceType?: string;
  resourceId?: string;
  status: JobStatus;
  result: TResult | null;
  error: string | null;
  tenantId?: string | null;
  actorId?: string | null;
  actorRole?: SystemUserRole | string | null;
  requestId?: string | null;
  dateCreated: number;
  lastUpdated: number;
}

/**
 * Query params for the paginated jobs list (`GET /v1/jobs`). Uses the older
 * `start` / `stop` convention — not `skip` / `limit`.
 */
export interface JobListParams {
  start?: number;
  stop?: number;
  /** Filter to a single terminal / transient status. */
  status?: JobStatus;
  /** Filter by taskKey prefix (e.g. `"db.write:department"`). */
  taskKey?: string;
}
