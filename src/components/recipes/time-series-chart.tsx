"use client";

import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ChartBodySkeleton } from "./chart-body-skeleton";
import type { TimeSeriesPoint } from "@/types/dashboard";

interface TimeSeriesChartProps {
  title: string;
  description?: string;
  /**
   * Series points. Accepts `null`/`undefined` because the Free-plan
   * dashboard payload nulls trend series fields by design — the card
   * falls through to the empty state in that case.
   */
  data: TimeSeriesPoint[] | null | undefined;
  /** HSL color string. Defaults to chart blue. */
  color?: string;
  height?: number;
  /** Render as MM/DD (the default) or full YYYY-MM-DD on the x-axis. */
  xAxisFormat?: "short" | "full";
  /** Tooltip series label (default "Value"). */
  valueLabel?: string;
  /** Format the y-axis tick + tooltip number (default `toLocaleString`). */
  valueFormatter?: (value: number) => string;
  /** Copy shown in the empty state when `data` is null/empty. */
  emptyTitle?: string;
  /**
   * When provided, points become clickable for drill-down: clicking a point
   * fires this with the underlying `TimeSeriesPoint`. Omitted → static chart.
   */
  onPointSelect?: (point: TimeSeriesPoint) => void;
  /** Highlight the currently-selected point labels (drill-down affordance). */
  selectedLabels?: string[];
}

/** Internal props consumed by the recharts-using body. Lives in the
 *  public wrapper module so the dynamic import target only depends on
 *  recharts, never on the wrapper's eagerly-loaded Card primitives. */
export interface TimeSeriesChartBodyProps {
  data: TimeSeriesPoint[];
  color: string;
  height: number;
  xAxisFormat: "short" | "full";
  valueLabel: string;
  valueFormatter: (value: number) => string;
  onPointSelect?: (point: TimeSeriesPoint) => void;
  selectedLabels?: string[];
}

const DEFAULT_COLOR = "hsl(217 91% 60%)";

// Charts are below-the-fold on every route they appear in, and recharts
// is ~80KB gzipped. Loading the body lazily keeps that cost off the
// initial bundle for non-dashboard routes that happen to import a chart
// recipe transitively (search results, audit log, etc.).
//
// IMPORTANT: every chart wrapper in this folder must import from
// `./chart-bodies` (the shared barrel), never from its own `-impl` file.
// `next/dynamic` keys chunks by import specifier, so a shared specifier
// collapses all three chart impls into ONE async chunk — recharts (and
// its lodash dep) ships exactly once per page rather than three times.
const TimeSeriesChartBody = dynamic(
  () =>
    import("./chart-bodies").then((m) => ({
      default: m.TimeSeriesChartBody,
    })),
  {
    ssr: false,
    loading: () => <ChartBodySkeleton height={240} />,
  },
);

export function TimeSeriesChart({
  title,
  description,
  data,
  color = DEFAULT_COLOR,
  height = 240,
  xAxisFormat = "short",
  valueLabel = "Value",
  valueFormatter = (value: number) => value.toLocaleString(),
  emptyTitle = "No data yet",
  onPointSelect,
  selectedLabels,
}: TimeSeriesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <EmptyState title={emptyTitle} />
        ) : (
          <TimeSeriesChartBody
            data={data}
            color={color}
            height={height}
            xAxisFormat={xAxisFormat}
            valueLabel={valueLabel}
            valueFormatter={valueFormatter}
            onPointSelect={onPointSelect}
            selectedLabels={selectedLabels}
          />
        )}
      </CardContent>
    </Card>
  );
}
