import { apiGet, type RequestConfig } from "./request";
import type { ListResponse, ListMeta } from "@/types/list";

/**
 * Typed GET for any backend list endpoint. The new contract returns
 * `{ items, meta }` directly inside the success envelope (already unwrapped
 * by the response interceptor).
 *
 * For migration tolerance only, this helper also accepts a bare array
 * response (the legacy contract). Bare arrays are wrapped into a synthetic
 * `{ items, meta }` so consumers always see the new shape. Once every list
 * endpoint is on the new contract, the legacy branch can be removed.
 */
export async function apiGetList<TItem>(
  url: string,
  params?: Record<string, unknown>,
  config?: RequestConfig,
): Promise<ListResponse<TItem>> {
  const data = await apiGet<unknown>(url, params, config);

  if (Array.isArray(data)) {
    const items = data as TItem[];
    const meta: ListMeta = {
      total: items.length,
      skip: typeof params?.skip === "number" ? (params.skip as number) : 0,
      limit:
        typeof params?.limit === "number" ? (params.limit as number) : items.length,
      hasMore: false,
    };
    return { items, meta };
  }

  if (data && typeof data === "object" && "items" in (data as Record<string, unknown>)) {
    const obj = data as { items: TItem[]; meta?: Partial<ListMeta> };
    const items = obj.items ?? [];
    const incoming = obj.meta ?? {};
    const meta: ListMeta = {
      total: incoming.total ?? items.length,
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
