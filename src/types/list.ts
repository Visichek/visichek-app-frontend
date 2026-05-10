/**
 * Pagination + facet envelope returned by every backend list endpoint.
 *
 * Shape on the wire (after the success-envelope interceptor unwraps):
 *
 *   {
 *     items: TItem[],
 *     meta: {
 *       total:    number,
 *       skip:     number,
 *       limit:    number,
 *       hasMore:  boolean,
 *       facets?:  Record<string, Record<string, number>>
 *     }
 *   }
 *
 * `facets` is present only when the request passed `?facets=<field>` and
 * the field is on the server-side allowlist for the resource.
 */
export interface ListMeta {
  total: number | null;
  skip: number;
  limit: number;
  hasMore: boolean;
  facets?: Record<string, Record<string, number>>;
}

export interface ListResponse<TItem> {
  items: TItem[];
  meta: ListMeta;
}

/**
 * Common query params accepted by every backend list endpoint. Resource-specific
 * filters extend this in their own param types.
 */
export interface ListParams {
  skip?: number;
  limit?: number;
  /**
   * Sort spec. Comma-separated `field` or `-field` (descending). The allowed
   * fields per resource are documented in `tables.txt`.
   */
  sort?: string;
  /** Free-text search; matches a documented set of fields per resource. */
  q?: string;
  /**
   * Comma-separated list of facet fields to compute. The server returns
   * `meta.facets[field] = { value: count, ... }`.
   */
  facets?: string;
}

/**
 * Bulk job result returned in `JobRecord.result` after the queued bulk
 * worker settles. Per-id outcomes live in `succeeded` / `failed`. When
 * `atomic` was true on the request and any id failed, `succeeded` is
 * empty and `failed` lists every id with the same root cause.
 */
export interface BulkJobResult<TPerIdResult = unknown> {
  succeeded: Array<{ id: string; result?: TPerIdResult }>;
  failed: Array<{ id: string; error: { code: string; message: string } }>;
  atomic: boolean;
}
