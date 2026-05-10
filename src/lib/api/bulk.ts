import { apiPost, type RequestConfig } from "./request";
import { generateIdempotencyKey } from "./idempotency";
import type { BulkJobResult } from "@/types/list";

const BULK_ID_HEX24 = /^[a-fA-F0-9]{24}$/;

export class BulkValidationError extends Error {
  constructor(public readonly invalidIds: string[]) {
    super(`Bulk request rejected: ${invalidIds.length} invalid id(s)`);
    this.name = "BulkValidationError";
  }
}

export interface BulkActionOptions {
  atomic?: boolean;
  /** Per-action body extras. Merged into the POST body alongside `ids`. */
  extras?: Record<string, unknown>;
  /** Pre-generated idempotency key. One is generated if omitted. */
  idempotencyKey?: string;
}

/**
 * POST a bulk action against the new queued-write backend contract.
 *
 *   1. Generates an `Idempotency-Key` (UUID v4) per call so retries are safe.
 *   2. Validates every id against `^[a-fA-F0-9]{24}$` — backend will also
 *      reject malformed ids, but failing closed on the FE saves a round-trip
 *      and stops the call from leaving the device. (See `tables.txt §0.5.1`.)
 *   3. POSTs to `path` with `{ ids, atomic?, ...extras }`.
 *   4. Lets the axios interceptor's auto-poll resolve the 202 ack into the
 *      worker's terminal `{ succeeded, failed, atomic }` result.
 *
 * Throws `BulkValidationError` if any id is non-hex24. Throws
 * `AsyncJobError` on a failed bulk job and `AsyncJobTimeoutError` on poll
 * timeout (both already thrown by the request layer).
 */
export async function bulkAction<TPerIdResult = unknown>(
  path: string,
  ids: string[],
  options: BulkActionOptions = {},
  config?: RequestConfig,
): Promise<BulkJobResult<TPerIdResult>> {
  const trimmed = Array.from(new Set(ids.filter((id) => typeof id === "string")));
  const invalid = trimmed.filter((id) => !BULK_ID_HEX24.test(id));
  if (invalid.length > 0) {
    throw new BulkValidationError(invalid);
  }
  if (trimmed.length === 0) {
    return { succeeded: [], failed: [], atomic: !!options.atomic };
  }

  const headers = {
    ...(config?.headers ?? {}),
    "Idempotency-Key": options.idempotencyKey ?? generateIdempotencyKey(),
  };
  const body = {
    ids: trimmed,
    ...(options.atomic !== undefined ? { atomic: options.atomic } : {}),
    ...(options.extras ?? {}),
  };

  return apiPost<BulkJobResult<TPerIdResult>>(path, body, {
    ...config,
    headers,
  });
}

/**
 * Render a sonner-friendly summary string for a bulk job result. Use as:
 *
 *   const result = await bulkAction(...);
 *   const { tone, message } = summarizeBulkResult(result, "tenant", "offboarded");
 *   toast[tone](message);
 */
export function summarizeBulkResult(
  result: BulkJobResult,
  noun: string,
  verbPast: string,
): { tone: "success" | "warning" | "error"; message: string } {
  const ok = result.succeeded.length;
  const failed = result.failed.length;
  const total = ok + failed;
  const plural = (n: number, singular: string) => (n === 1 ? singular : `${singular}s`);

  if (failed === 0) {
    return {
      tone: "success",
      message: `${ok} ${plural(ok, noun)} ${verbPast}`,
    };
  }
  if (ok === 0) {
    const code = result.failed[0]?.error?.code;
    return {
      tone: "error",
      message: code
        ? `Failed to ${verbPast} ${total} ${plural(total, noun)} — ${code}`
        : `Failed to ${verbPast} ${total} ${plural(total, noun)}`,
    };
  }
  return {
    tone: "warning",
    message: `${ok} ${verbPast}, ${failed} failed — check the table for any rows that did not change`,
  };
}
