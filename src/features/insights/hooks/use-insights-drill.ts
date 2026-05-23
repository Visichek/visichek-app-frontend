"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";

/**
 * Drill-down: the records behind a clicked chart element.
 *   tenant   -> GET /v1/dashboard/insights/drill
 *   platform -> GET /v1/admins/dashboard/insights/drill
 * Honours the same range + filters as the parent insights call so the rows
 * match the chart. Unsupported (section,key) combos return an empty result.
 */

export interface DrillResponse {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
  total: number;
}

export type InsightsScope = "tenant" | "admin";

/** Extra query params (range + filters) passed straight through, snake_cased. */
export type DrillQueryParams = Record<string, string>;

const drillKeys = {
  query: (scope: InsightsScope, section: string, key: string, params: DrillQueryParams) =>
    ["insights", "drill", scope, section, key, params] as const,
};

export function useInsightsDrill(
  scope: InsightsScope,
  section: string,
  elementKey: string,
  params: DrillQueryParams,
  options: { enabled?: boolean } = {},
) {
  const url =
    scope === "admin"
      ? "/admins/dashboard/insights/drill"
      : "/dashboard/insights/drill";

  return useQuery({
    queryKey: drillKeys.query(scope, section, elementKey, params),
    queryFn: () =>
      apiGet<DrillResponse>(url, { section, key: elementKey, ...params }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

useInsightsDrill.keys = drillKeys;
