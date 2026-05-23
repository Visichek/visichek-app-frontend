"use client";

import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUpgradePrompt } from "@/features/limitations/components";
import { formatDate } from "@/lib/utils/format-date";
import { ANALYTICS_FEATURES } from "../lib/analytics-gates";
import {
  type DateRange,
  type RangePresetKey,
  RANGE_PRESETS,
  dateInputToEpoch,
  dateInputToEpochEnd,
  epochToDateInput,
} from "../lib/ranges";
import { SegmentButton, SegmentedControl } from "./segmented";
import type { Granularity } from "@/types/insights";

const GRANULARITY_OPTIONS: Array<{ key: Granularity | "auto"; label: string; hint: string }> = [
  { key: "auto", label: "Auto", hint: "Pick the bucket size automatically from the window length" },
  { key: "hour", label: "Hour", hint: "Bucket the series by hour" },
  { key: "day", label: "Day", hint: "Bucket the series by day" },
  { key: "week", label: "Week", hint: "Bucket the series by week" },
  { key: "month", label: "Month", hint: "Bucket the series by month" },
];

export interface RangePickerProps {
  presetKey: RangePresetKey;
  range: DateRange;
  granularity: Granularity | "auto";
  /** The bucket size the server actually used (shown as a hint under Auto). */
  effectiveGranularity?: Granularity;
  tenantCreatedAt: number;
  /** First day with data; lets us hint the empty leading window. */
  earliestData?: number;
  /** The window the server actually computed, for the clamp note. */
  appliedRange?: { start: number; stop: number } | null;
  canCustomRange: boolean;
  /** Loading target so a spinner shows on the clicked preset. */
  pendingKey: string | null;
  onPreset: (key: Exclude<RangePresetKey, "custom">) => void;
  onCustomRange: (range: DateRange) => void;
  onGranularity: (g: Granularity | "auto") => void;
  /** Restrict which presets show (in order). Defaults to all. */
  presets?: RangePresetKey[];
  /** Show the granularity override row. Defaults to true. */
  showGranularity?: boolean;
}

/**
 * Adjustable time-range control for the Insights page. Presets resolve to a
 * concrete window; "Custom" reveals two native date inputs clamped to the
 * tenant's tenure (you cannot scroll back before the account existed). On Free
 * the whole control is locked to "Last 7 days" with an upgrade affordance.
 */
export function RangePicker({
  presetKey,
  range,
  granularity,
  effectiveGranularity,
  tenantCreatedAt,
  earliestData,
  appliedRange,
  canCustomRange,
  pendingKey,
  onPreset,
  onCustomRange,
  onGranularity,
  presets,
  showGranularity = true,
}: RangePickerProps) {
  const { promptUpgrade } = useUpgradePrompt();
  const visiblePresets = presets
    ? RANGE_PRESETS.filter((p) => presets.includes(p.key))
    : RANGE_PRESETS;

  // ── Free: locked to a fixed 7-day window ────────────────────────────
  if (!canCustomRange) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Time range</span>
        <button
          type="button"
          onClick={() =>
            promptUpgrade({
              featureKey: ANALYTICS_FEATURES.customRange,
              title: "Custom date ranges",
            })
          }
          title="Free plans see the last 7 days. Upgrade to choose any date range."
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          Last 7 days
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            Upgrade
          </span>
        </button>
      </div>
    );
  }

  // ── Paid: presets + optional custom inputs + granularity ────────────
  const minDate = epochToDateInput(tenantCreatedAt);
  const today = epochToDateInput(Math.floor(Date.now() / 1000));
  const isCustom = presetKey === "custom";

  // Show the clamp note when the server pulled `start` forward to tenure.
  const clamped =
    appliedRange != null && appliedRange.start > range.start + 60;

  function handleFrom(value: string) {
    const start = dateInputToEpoch(value);
    if (start == null) return;
    onCustomRange({ start, stop: Math.max(start, range.stop) });
  }

  function handleTo(value: string) {
    const stop = dateInputToEpochEnd(value);
    if (stop == null) return;
    onCustomRange({ start: Math.min(range.start, stop), stop });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-4">
        <SegmentedControl label="Time range" className="flex-wrap">
          {visiblePresets.map((p) => (
            <SegmentButton
              key={p.key}
              active={presetKey === p.key}
              loading={pendingKey === `range-${p.key}`}
              title={p.hint}
              onClick={() =>
                p.key === "custom"
                  ? onCustomRange(range) // reveal inputs; keep current window
                  : onPreset(p.key)
              }
            >
              {p.label}
            </SegmentButton>
          ))}
        </SegmentedControl>

        {showGranularity && (
          <SegmentedControl label="Granularity" className="flex-wrap">
            {GRANULARITY_OPTIONS.map((g) => (
              <SegmentButton
                key={g.key}
                active={granularity === g.key}
                loading={pendingKey === `gran-${g.key}`}
                title={g.hint}
                onClick={() => onGranularity(g.key)}
              >
                {g.label}
              </SegmentButton>
            ))}
          </SegmentedControl>
        )}
      </div>

      {isCustom && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            From
            <Input
              type="date"
              value={epochToDateInput(range.start)}
              min={minDate}
              max={today}
              onChange={(e) => handleFrom(e.target.value)}
              className="h-11 w-[10.5rem] text-base md:h-9 md:text-sm"
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
              onChange={(e) => handleTo(e.target.value)}
              className="h-11 w-[10.5rem] text-base md:h-9 md:text-sm"
              aria-label="Range end date"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {granularity === "auto" && effectiveGranularity && (
          <span>Bucketed by {effectiveGranularity}</span>
        )}
        {clamped && appliedRange && (
          <span className="text-amber-700 dark:text-amber-300">
            Showing {formatDate(appliedRange.start)} – {formatDate(appliedRange.stop)} · clamped to account start
          </span>
        )}
        {!clamped && earliestData != null && earliestData > range.start + 60 && (
          <span>Data begins {formatDate(earliestData)}</span>
        )}
      </div>
    </div>
  );
}
