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
import type { HeatmapBarsBodyProps } from "./heatmap-bars";

export function HeatmapBarsBody({
  data,
  height,
  color,
  unit,
}: HeatmapBarsBodyProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <XAxis
          dataKey="label"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          interval="preserveStartEnd"
          minTickGap={16}
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
  );
}
