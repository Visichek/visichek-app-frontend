"use client";

import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils/format-date";
import { SegmentButton, SegmentedControl } from "./segmented";
import {
  type DateRange,
  dateInputToEpoch,
  dateInputToEpochEnd,
  epochToDateInput,
} from "../lib/ranges";

export type RangeMode = "recent" | "all" | "custom";

const ONE_DAY = 86_400;

export interface AdminRangeBarProps {
  mode: RangeMode;
  /** Rolling window length in days (used when mode === "recent"). */
  rollingDays: number;
  range: DateRange;
  platformLaunchAt: number;
  effectiveGranularity?: string;
  onMode: (mode: RangeMode) => void;
  onRollingDays: (days: number) => void;
  onCustomRange: (range: DateRange) => void;
}

function windowLabel(days: number): string {
  if (days >= 365) return `Last ${Math.round(days / 365)}y`;
  if (days >= 60) return `Last ${Math.round(days / 30)}mo`;
  return `Last ${days}d`;
}

/**
 * Compact one-line range control for the admin Insights page:
 *  - a slider for a rolling "last N days" window,
 *  - "All time" and "Custom" alternatives,
 *  - the Filters trigger (opens the blurred overlay) at the end.
 * Active filters render as chips below this bar (in the client).
 */
export function AdminRangeBar({
  mode,
  rollingDays,
  range,
  platformLaunchAt,
  effectiveGranularity,
  onMode,
  onRollingDays,
  onCustomRange,
}: AdminRangeBarProps) {
  const maxDays = Math.max(7, Math.round((Date.now() / 1000 - platformLaunchAt) / ONE_DAY));
  const minDate = epochToDateInput(platformLaunchAt);
  const today = epochToDateInput(Math.floor(Date.now() / 1000));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <SegmentedControl label="Time range">
          <SegmentButton active={mode === "recent"} title="A rolling window ending today" onClick={() => onMode("recent")}>
            Recent
          </SegmentButton>
          <SegmentButton active={mode === "all"} title="Everything since the platform launched" onClick={() => onMode("all")}>
            All time
          </SegmentButton>
          <SegmentButton active={mode === "custom"} title="Pick exact start and end dates" onClick={() => onMode("custom")}>
            Custom
          </SegmentButton>
        </SegmentedControl>

        {mode === "recent" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {windowLabel(rollingDays)}
              {effectiveGranularity ? ` · by ${effectiveGranularity}` : ""}
            </span>
            <input
              type="range"
              min={1}
              max={maxDays}
              value={Math.min(rollingDays, maxDays)}
              onChange={(e) => onRollingDays(Number(e.target.value))}
              aria-label={`Rolling window length: ${windowLabel(rollingDays)}`}
              className="h-2 w-56 cursor-pointer appearance-none rounded-full bg-muted accent-[hsl(262_83%_58%)]"
            />
          </div>
        )}

        {mode === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              From
              <Input
                type="date"
                value={epochToDateInput(range.start)}
                min={minDate}
                max={today}
                onChange={(e) => {
                  const start = dateInputToEpoch(e.target.value);
                  if (start != null) onCustomRange({ start, stop: Math.max(start, range.stop) });
                }}
                className="h-9 w-[9.5rem] text-base md:text-sm"
                aria-label="Range start date"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              To
              <Input
                type="date"
                value={epochToDateInput(range.stop)}
                min={epochToDateInput(range.start)}
                max={today}
                onChange={(e) => {
                  const stop = dateInputToEpochEnd(e.target.value);
                  if (stop != null) onCustomRange({ start: Math.min(range.start, stop), stop });
                }}
                className="h-9 w-[9.5rem] text-base md:text-sm"
                aria-label="Range end date"
              />
            </label>
          </div>
        )}

        {mode === "all" && (
          <span className="text-xs text-muted-foreground">
            Since {formatDate(platformLaunchAt)}
          </span>
        )}
      </div>
    </div>
  );
}
