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
import type { DistributionSlice } from "@/types/dashboard";

export function DistributionPieBody({
  data,
  height,
  onSliceSelect,
  selectedKeys,
}: DistributionPieBodyProps) {
  const id = useId();
  const interactive = typeof onSliceSelect === "function";
  const hasSelection = Array.isArray(selectedKeys) && selectedKeys.length > 0;
  const isSelected = (key: string) => Boolean(selectedKeys?.includes(key));

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
          style={interactive ? { cursor: "pointer", outline: "none" } : undefined}
          onClick={
            interactive
              ? (entry: { payload?: DistributionSlice } & DistributionSlice) => {
                  const slice = entry?.payload ?? entry;
                  if (slice?.key) onSliceSelect?.(slice);
                }
              : undefined
          }
        >
          {data.map((slice, idx) => (
            <Cell
              key={`${id}-${slice.key}`}
              fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
              fillOpacity={hasSelection && !isSelected(slice.key) ? 0.35 : 1}
              stroke={isSelected(slice.key) ? "hsl(var(--foreground))" : "hsl(var(--card))"}
              strokeWidth={isSelected(slice.key) ? 2.5 : 2}
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
          // Recharts colours item text with the slice colour by default, which
          // is unreadable on the dark popover — force the popover foreground.
          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
          labelStyle={{ color: "hsl(var(--popover-foreground))" }}
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
