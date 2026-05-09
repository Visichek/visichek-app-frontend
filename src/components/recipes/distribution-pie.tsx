"use client";

import { useId } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
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

export function DistributionPie({
  title,
  description,
  data,
  height = 240,
  emptyTitle = "No data yet",
}: DistributionPieProps) {
  const id = useId();

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
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={data.length > 1 ? 2 : 0}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {data.map((slice, idx) => (
                  <Cell
                    key={`${id}-${slice.key}`}
                    fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name, payload) => [
                  `${value.toLocaleString()} (${payload?.payload?.percentage?.toFixed(1) ?? 0}%)`,
                  payload?.payload?.label,
                ]}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
