"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeSeriesPoint } from "@/types/dashboard";
import type { TimeSeriesChartBodyProps } from "./time-series-chart";

export function TimeSeriesChartBody({
  data,
  color,
  height,
  xAxisFormat,
  valueLabel,
  valueFormatter,
  onPointSelect,
  selectedLabels,
}: TimeSeriesChartBodyProps) {
  const id = useId();
  const gradientId = `ts-grad-${id}`;
  const formatX = xAxisFormat === "short" ? toShortDate : (l: string) => l;
  const interactive = typeof onPointSelect === "function";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        style={interactive ? { cursor: "pointer" } : undefined}
        onClick={
          interactive
            ? (state: { activePayload?: Array<{ payload: TimeSeriesPoint }> }) => {
                const point = state?.activePayload?.[0]?.payload;
                if (point) onPointSelect?.(point);
              }
            : undefined
        }
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tickFormatter={formatX}
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={20}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={valueFormatter}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          // Force readable value text on the dark popover (recharts otherwise
          // tints it with the series colour).
          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
          formatter={(value: number) => [valueFormatter(value), valueLabel]}
        />
        {selectedLabels?.map((label) => (
          <ReferenceLine key={label} x={label} stroke={color} strokeDasharray="4 2" />
        ))}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          activeDot={interactive ? { r: 5 } : undefined}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** YYYY-MM-DD → MM/DD. */
function toShortDate(label: string): string {
  if (typeof label === "string" && label.length === 10) {
    return label.slice(5).replace("-", "/");
  }
  return label;
}
