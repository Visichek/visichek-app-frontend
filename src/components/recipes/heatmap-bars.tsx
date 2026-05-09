"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

const DEFAULT_COLOR = "hsl(217 91% 60%)";

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
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              interval={0}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              contentStyle={{
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [
                `${value.toLocaleString()}${unit ? ` ${unit}` : ""}`,
                "",
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={`${d.label}-${i}`}
                  fill={color}
                  fillOpacity={0.25 + 0.75 * (d.value / max)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
