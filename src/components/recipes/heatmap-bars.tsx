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

interface HeatmapBarsProps {
  title: string;
  description?: string;
  data: Array<{ label: string; value: number }>;
  height?: number;
  /** HSL color string. Defaults to chart blue. */
  color?: string;
  /** Tooltip suffix for the bar value (e.g. "visits"). */
  unit?: string;
}

export type HeatmapBarsBodyProps = Required<
  Pick<HeatmapBarsProps, "data" | "height" | "color">
> & { unit?: string };

const DEFAULT_COLOR = "hsl(217 91% 60%)";

// Shared dynamic specifier — see comment in `time-series-chart.tsx` for why
// every chart wrapper imports from `./chart-bodies` rather than its own
// `-impl` file (collapses three recharts chunks into one).
const HeatmapBarsBody = dynamic(
  () =>
    import("./chart-bodies").then((m) => ({
      default: m.HeatmapBarsBody,
    })),
  {
    ssr: false,
    loading: () => <ChartBodySkeleton height={200} />,
  },
);

/**
 * Single-row bar visualization for fixed-width buckets — used for the
 * hourly (24 buckets) and day-of-week (7 buckets) distributions. Each
 * bar's fill opacity scales with its value so the busiest bucket reads
 * darkest, mimicking a 1-D heatmap strip.
 */
export function HeatmapBars({
  title,
  description,
  data,
  height = 200,
  color = DEFAULT_COLOR,
  unit,
}: HeatmapBarsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <HeatmapBarsBody data={data} height={height} color={color} unit={unit} />
      </CardContent>
    </Card>
  );
}
