"use client";

import { ChartBodySkeleton } from "@/components/recipes/chart-body-skeleton";
import { useInsightsDrill, type InsightsScope } from "../hooks/use-insights-drill";
import { InsightsMiniTable } from "./section-renderer";

/**
 * Fetches and renders the records behind one selected chart element. Used by
 * both dashboards' Selection panel; the only difference is `scope`.
 */
export function DrillBlock({
  scope,
  sectionId,
  elementKey,
  params,
}: {
  scope: InsightsScope;
  sectionId: string;
  elementKey: string;
  params: Record<string, string>;
}) {
  const { data, isLoading, isError } = useInsightsDrill(scope, sectionId, elementKey, params);

  if (isLoading) return <ChartBodySkeleton height={120} />;
  if (isError) return <p className="text-sm text-destructive">Couldn&apos;t load these records.</p>;
  if (!data) return null;
  if (data.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No records for this selection.</p>;
  }

  return (
    <div className="space-y-1.5">
      <InsightsMiniTable columns={data.columns} rows={data.rows} />
      {data.total > data.rows.length && (
        <p className="text-xs text-muted-foreground">
          Showing {data.rows.length} of {data.total.toLocaleString()}
        </p>
      )}
    </div>
  );
}
