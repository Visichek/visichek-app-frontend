"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { Kpi } from "@/types/insights";

/**
 * One Insights KPI tile. Unlike the generic dashboard `StatCard`, the trend
 * arrow's colour is metric-aware: it follows `trend.isGood`, not the sign of
 * the change (a rising no-show rate is red even though it went "up"). No trend
 * (live/current metrics, or Free) renders no arrow.
 */
export function InsightsKpiCard({ kpi }: { kpi: Kpi }) {
  const trend = kpi.trend ?? null;
  const TrendIcon =
    trend == null
      ? null
      : trend.direction === "up"
        ? ArrowUp
        : trend.direction === "down"
          ? ArrowDown
          : Minus;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
          {kpi.unit ? <span className="ml-0.5 text-base font-semibold">{kpi.unit}</span> : null}
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {trend && TrendIcon && (
            <span
              className={cn(
                "inline-flex items-center font-medium",
                trend.direction === "flat"
                  ? "text-muted-foreground"
                  : trend.isGood
                    ? "text-success"
                    : "text-destructive",
              )}
            >
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              {Math.abs(trend.changePercent)}%
            </span>
          )}
          <span>{kpi.description}</span>
        </p>
      </CardContent>
    </Card>
  );
}
