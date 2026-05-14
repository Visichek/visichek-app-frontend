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
import { CHART_PALETTE, type DistributionPieBodyProps } from "./distribution-pie";

export function DistributionPieBody({
  data,
  height,
}: DistributionPieBodyProps) {
  const id = useId();

  return (
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
  );
}
