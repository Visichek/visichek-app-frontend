"use client";

import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartBodySkeleton } from "./chart-body-skeleton";
import type { TimeSeriesPoint } from "@/types/dashboard";

interface TimeSeriesChartProps {
  title: string;
  description?: string;
  data: TimeSeriesPoint[];
  /** HSL color string. Defaults to chart blue. */
  color?: string;
  height?: number;
  /** Render as MM/DD (the default) or full YYYY-MM-DD on the x-axis. */
  xAxisFormat?: "short" | "full";
  /** Tooltip series label (default "Value"). */
  valueLabel?: string;
  /** Format the y-axis tick + tooltip number (default `toLocaleString`). */
  valueFormatter?: (value: number) => string;
}

/** Internal props consumed by the recharts-using body. Lives in the
 *  public wrapper module so the dynamic import target only depends on
 *  recharts, never on the wrapper's eagerly-loaded Card primitives. */
export type TimeSeriesChartBodyProps = Required<
  Pick<
    TimeSeriesChartProps,
    "data" | "color" | "height" | "xAxisFormat" | "valueLabel" | "valueFormatter"
  >
>;

const DEFAULT_COLOR = "hsl(217 91% 60%)";

// Charts are below-the-fold on every route they appear in, and recharts
// is ~80KB gzipped. Loading the body lazily keeps that cost off the
// initial bundle for non-dashboard routes that happen to import a chart
// recipe transitively (search results, audit log, etc.).
const TimeSeriesChartBody = dynamic(
  () =>
    import("./time-series-chart-impl").then((m) => ({
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
}: TimeSeriesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <TimeSeriesChartBody
          data={data}
          color={color}
          height={height}
          xAxisFormat={xAxisFormat}
          valueLabel={valueLabel}
          valueFormatter={valueFormatter}
        />
      </CardContent>
    </Card>
  );
}
