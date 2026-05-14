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
  data: DistributionSlice[];
  height?: number;
  emptyTitle?: string;
}

export type DistributionPieBodyProps = Required<
  Pick<DistributionPieProps, "data" | "height">
>;

const DistributionPieBody = dynamic(
  () =>
    import("./distribution-pie-impl").then((m) => ({
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
        {data.length === 0 ? (
          <EmptyState title={emptyTitle} />
        ) : (
          <DistributionPieBody data={data} height={height} />
        )}
      </CardContent>
    </Card>
  );
}
