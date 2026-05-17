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
import type { DistributionSlice } from "@/types/dashboard";

/**
 * Eight visually-distinct hues that read in both light and dark themes.
 * Order is stable so the same enum slice keeps its color across renders.
 */
export const CHART_PALETTE = [
  "hsl(217 91% 60%)", // blue
  "hsl(142 71% 45%)", // green
  "hsl(38 92% 50%)", // amber
  "hsl(0 84% 60%)", // red
  "hsl(262 83% 58%)", // violet
  "hsl(199 89% 48%)", // sky
  "hsl(330 81% 60%)", // pink
  "hsl(173 80% 40%)", // teal
];

interface DistributionPieProps {
  title: string;
  description?: string;
  /**
   * Slices to render. Accepts `null`/`undefined` because the Free-plan
   * dashboard payload nulls these distribution fields by design — the
   * card falls through to the empty state in that case.
   */
  data: DistributionSlice[] | null | undefined;
  height?: number;
  emptyTitle?: string;
}

export interface DistributionPieBodyProps {
  data: DistributionSlice[];
  height: number;
}

// Shared dynamic specifier — see comment in `time-series-chart.tsx` for why
// every chart wrapper imports from `./chart-bodies` rather than its own
// `-impl` file (collapses three recharts chunks into one).
const DistributionPieBody = dynamic(
  () =>
    import("./chart-bodies").then((m) => ({
      default: m.DistributionPieBody,
    })),
  {
    ssr: false,
    loading: () => <ChartBodySkeleton height={240} />,
  },
);

export function DistributionPie({
  title,
  description,
  data,
  height = 240,
  emptyTitle = "No data yet",
}: DistributionPieProps) {
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
          <DistributionPieBody data={data} height={height} />
        )}
      </CardContent>
    </Card>
  );
}
