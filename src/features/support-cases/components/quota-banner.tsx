import { Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface QuotaBannerProps {
  /** Current number of open cases for this tenant. */
  openCount: number;
  /** Tenant cap — 10 per the backend contract. */
  cap?: number;
  className?: string;
}

/**
 * Small banner reminding the tenant of the 10-open-case cap. Colour shifts
 * from muted to warning as they approach the limit.
 */
export function QuotaBanner({ openCount, cap = 10, className }: QuotaBannerProps) {
  const remaining = Math.max(0, cap - openCount);
  const atCap = remaining === 0;
  const nearCap = !atCap && remaining <= 2;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        atCap
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : nearCap
            ? "border-warning/50 bg-warning/10 text-warning"
            : "border-border bg-muted/30 text-muted-foreground",
        className,
      )}
      role="status"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">
          You've used {openCount} of {cap} open support cases.
        </p>
        <p className="text-xs">
          {atCap
            ? "You cannot open a new case until an existing one is resolved or closed."
            : nearCap
              ? `Only ${remaining} remaining. Resolve older cases to free up room.`
              : "Each case stays open until it's resolved and confirmed."}
        </p>
      </div>
    </div>
  );
}
