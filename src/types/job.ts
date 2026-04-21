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
 * Denormalized actor info embedded on `GET /v1/jobs/{jobId}` so the UI can
 * render "Triggered by Jane Doe" without hopping to /users/{id}. Always
 * nullable — older rows may predate the field and workers without a known
 * actor (system tasks) will omit it.
 */
export interface JobActorSummary {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: SystemUserRole | string | null;
  userType?: string | null;
}

/**
 * Denormalized tenant info embedded on job rows. Platform-admin jobs will
 * have a null `tenantSummary` (the job is not tenant-scoped).
 */
export interface JobTenantSummary {
  id: string;
  name?: string | null;
  slug?: string | null;
}

/**
 * Denormalized resource info embedded on job rows. Shape varies by
 * `resourceType` (e.g. a visitor summary has `fullName`, a discount summary
 * has `code`), so most fields are optional. Render whichever are present.
 */
export interface JobResourceSummary {
  id: string;
  type?: string | null;
  name?: string | null;
  label?: string | null;
  title?: string | null;
  code?: string | null;
  status?: string | null;
  fullName?: string | null;
  email?: string | null;
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
  /** Celery task id (primary identifier for polling). */
  taskId: string;
  /** Mongo document id of the job log row. Distinct from `taskId`. */
  id?: string;
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
  actorSummary?: JobActorSummary | null;
  tenantSummary?: JobTenantSummary | null;
  resourceSummary?: JobResourceSummary | null;
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
