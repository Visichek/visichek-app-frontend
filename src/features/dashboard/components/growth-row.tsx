import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { GrowthMetric } from "@/types/dashboard";

interface GrowthRowProps {
  metrics: Array<{
    label: string;
    metric: GrowthMetric;
    /** Lower is better (e.g. "denials"); flips arrow color. */
    inverse?: boolean;
  }>;
}

/**
 * Three-up grid of "current vs previous" growth metrics with arrow + delta.
 * Wraps the GrowthMetric tuples (visitsGrowthDod / Wow / Mom, etc.) returned
 * in section 5 of the dashboard payload.
 */
export function GrowthRow({ metrics }: GrowthRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {metrics.map(({ label, metric, inverse }) => {
        const positive = metric.changePercent > 0;
        const negative = metric.changePercent < 0;
        const flat = !positive && !negative;
        const good = inverse ? negative : positive;
        const bad = inverse ? positive : negative;

        return (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">
                  {metric.current.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  vs {metric.previous.toLocaleString()}
                </span>
              </div>
              <div
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-sm tabular-nums",
                  flat && "text-muted-foreground",
                  good && "text-success",
                  bad && "text-destructive",
                )}
              >
                {flat ? (
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                ) : positive ? (
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>
                  {positive ? "+" : ""}
                  {metric.changePercent.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
