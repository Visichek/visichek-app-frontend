import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export interface StatGroupItem {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export interface StatGroupProps {
  title?: string;
  description?: string;
  items: StatGroupItem[];
  /** Number of columns at >= md. Defaults to a sensible value derived from items.length. */
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<StatGroupItem["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const COL_CLASS: Record<NonNullable<StatGroupProps["columns"]>, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
};

function autoColumns(count: number): NonNullable<StatGroupProps["columns"]> {
  if (count <= 2) return 2;
  if (count <= 3) return 3;
  if (count <= 4) return 4;
  if (count <= 5) return 5;
  return 6;
}

/**
 * Compact stat grid sharing a single border. Use instead of N adjacent
 * StatCards when the metrics belong to the same group (e.g. tenant counts
 * sliced by time window, or role breakdowns). Reduces visual chrome.
 */
export function StatGroup({
  title,
  description,
  items,
  columns,
  className,
}: StatGroupProps) {
  const cols = columns ?? autoColumns(items.length);

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader className="pb-3">
          {title && (
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent className={cn("grid gap-x-6 gap-y-4", COL_CLASS[cols], !title && "pt-6")}>
        {items.map((item) => {
          const tone = TONE_CLASS[item.tone ?? "default"];
          return (
            <div key={item.label} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                {item.icon && (
                  <span className="text-muted-foreground" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "mt-1 text-xl font-semibold tabular-nums",
                  tone,
                )}
              >
                {item.value}
              </div>
              {(item.description || item.trend) && (
                <p className="text-[11px] text-muted-foreground">
                  {item.trend && (
                    <span
                      className={cn(
                        "mr-1",
                        item.trend.isPositive
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {item.trend.isPositive ? "+" : ""}
                      {item.trend.value.toFixed(1)}%
                    </span>
                  )}
                  {item.description}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
