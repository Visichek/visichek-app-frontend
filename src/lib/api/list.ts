import apiClient from "./client";
import { type RequestConfig } from "./request";
import type { ListResponse, ListMeta } from "@/types/list";

/**
 * Typed GET for any backend list endpoint. The success envelope is
 *   { success, data, meta, ... }
 * and the response interceptor unwraps it so that:
 *   - `axiosResponse.data` is the envelope `data` (an array OR { items, meta })
 *   - `axiosResponse.meta` is the envelope `meta` (pagination + facets)
 *
 * `apiGet` returns only `axiosResponse.data`, which loses the envelope-level
 * `meta.facets` when the backend ships `data` as a bare array. We bypass it
 * here to capture both.
 *
 * Tolerated shapes (in priority order):
 *   1. `data` is a bare array + envelope `meta` is present (current contract)
 *   2. `data` is `{ items, meta }` (older or per-endpoint contract)
 *   3. `data` is a bare array with no envelope meta (legacy)
 */
export async function apiGetList<TItem>(
  url: string,
  params?: Record<string, unknown>,
  config?: RequestConfig,
): Promise<ListResponse<TItem>> {
  const response = await apiClient.get(url, { ...config, params });
  const data = response.data as unknown;
  // The interceptor attaches `meta` from the envelope onto the axios
  // response object itself. Axios doesn't type it, so cast.
  const envelopeMeta = (response as { meta?: Partial<ListMeta> }).meta;

  if (Array.isArray(data)) {
    const items = data as TItem[];
    const incoming = envelopeMeta ?? {};
    // Leave `total` null when the backend doesn't return one — newer
    // skip/limit endpoints ship `{ skip, limit, hasMore }` without a count,
    // and synthesizing `items.length` here masks "there's more" from the
    // pager.
    const meta: ListMeta = {
      total: incoming.total ?? null,
      skip:
        incoming.skip ??
        (typeof params?.skip === "number" ? (params.skip as number) : 0),
      limit:
        incoming.limit ??
        (typeof params?.limit === "number"
          ? (params.limit as number)
          : items.length),
      hasMore: incoming.hasMore ?? false,
      facets: incoming.facets,
    };
    return { items, meta };
  }

  if (
    data &&
    typeof data === "object" &&
    "items" in (data as Record<string, unknown>)
  ) {
    const obj = data as { items: TItem[]; meta?: Partial<ListMeta> };
    const items = obj.items ?? [];
    // Prefer the meta nested inside `data` for this shape; fall back to the
    // envelope meta in case the backend split them.
    const incoming = obj.meta ?? envelopeMeta ?? {};
    const meta: ListMeta = {
      total: incoming.total ?? null,
      skip: incoming.skip ?? 0,
      limit: incoming.limit ?? items.length,
      hasMore: incoming.hasMore ?? false,
      facets: incoming.facets,
    };
    return { items, meta };
  }

  return {
    items: [],
    meta: { total: 0, skip: 0, limit: 0, hasMore: false },
  };
}
