import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import type { TopItem } from "@/types/dashboard";

interface TopListProps {
  title: string;
  description?: string;
  /**
   * Ranked items. Accepts `null`/`undefined` because the Free-plan
   * dashboard payload nulls top-N fields by design — the card falls
   * through to the empty state in that case.
   */
  items: TopItem[] | null | undefined;
  unit?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Optional row click handler — adds focus styles + cursor when set. */
  onRowClick?: (item: TopItem) => void;
}

/**
 * Ranked list with horizontal bar fill behind each row. Drives the spec's
 * Top-N tables (top departments, hosts, companies, …). The percentage is
 * the share of the top-N total — bars fill proportionally.
 */
export function TopList({
  title,
  description,
  items,
  unit,
  emptyTitle = "No data yet",
  emptyDescription,
  onRowClick,
}: TopListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {!items || items.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <ol className="space-y-3">
            {items.map((item, idx) => {
              const interactive = Boolean(onRowClick);
              const handleClick = () => onRowClick?.(item);
              return (
                <li
                  key={item.id ?? `${idx}-${item.label}`}
                  {...(interactive
                    ? {
                        role: "button" as const,
                        tabIndex: 0,
                        onClick: handleClick,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClick();
                          }
                        },
                        className:
                          "cursor-pointer rounded-md p-1 -m-1 transition-colors hover:bg-muted focus:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      }
                    : {})}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-muted-foreground tabular-nums">
                        {idx + 1}.
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">
                        {item.value.toLocaleString()}
                      </span>
                      {unit ? (
                        <span className="ml-1 text-muted-foreground">
                          {unit}
                        </span>
                      ) : null}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
