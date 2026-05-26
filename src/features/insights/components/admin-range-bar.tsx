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

const ONE_DAY = 86_400;

/** Discrete time-range presets the dashboard offers (plus "custom"). */
export type AdminRangeKey = "today" | "7d" | "60d" | "90d" | "all" | "custom";

interface PresetDef {
  key: AdminRangeKey;
  label: string;
  title: string;
  /** Window length in days. `0` = today (since midnight); `null` = all-time. */
  days: number | null;
}

const PRESETS: PresetDef[] = [
  { key: "today", label: "Today", title: "Activity since midnight today", days: 0 },
  { key: "7d", label: "Last 7d", title: "The last 7 days", days: 7 },
  { key: "60d", label: "Last 60d", title: "The last 60 days", days: 60 },
  { key: "90d", label: "Last 90d", title: "The last 90 days", days: 90 },
  { key: "all", label: "All time", title: "Everything since launch", days: null },
];

/**
 * Resolve a preset key to a concrete `{ start, stop }` window in unix seconds.
 * `lowerBound` is the platform launch / tenant creation date used for
 * "all time". "custom" is handled by the caller (it keeps the existing window).
 */
export function resolveAdminRange(
  key: Exclude<AdminRangeKey, "custom">,
  lowerBound: number,
  now: number = Math.floor(Date.now() / 1000),
): DateRange {
  if (key === "all") return { start: lowerBound, stop: now };
  if (key === "today") {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return { start: Math.floor(midnight.getTime() / 1000), stop: now };
  }
  const days = key === "7d" ? 7 : key === "60d" ? 60 : 90;
  return { start: now - days * ONE_DAY, stop: now };
}

export interface AdminRangeBarProps {
  /** The active preset (or "custom" when exact dates are chosen). */
  activeKey: AdminRangeKey;
  range: DateRange;
  /** Platform launch (admin) or tenant creation date (tenant) — lower bound. */
  platformLaunchAt: number;
  /**
   * Whether the real launch date is known yet. Until it is, the longer presets
   * stay hidden so they don't flash in and out while the first fetch resolves
   * (the lower bound otherwise defaults to a far-back fallback).
   */
  historyKnown?: boolean;
  effectiveGranularity?: string;
  onPreset: (key: AdminRangeKey) => void;
  onCustomRange: (range: DateRange) => void;
}

/**
 * Time-range control for the Insights dashboards: discrete date presets
 * (Today / 7d / 60d / 90d / All time) plus a Custom date-range option.
 * Presets longer than the available history are hidden ("limit to what's
 * available"); the resolved window is shown beneath the buttons.
 */
export function AdminRangeBar({
  activeKey,
  range,
  platformLaunchAt,
  historyKnown = true,
  effectiveGranularity,
  onPreset,
  onCustomRange,
}: AdminRangeBarProps) {
  const now = Math.floor(Date.now() / 1000);
  const maxDays = Math.max(1, Math.round((now - platformLaunchAt) / ONE_DAY));
  const minDate = epochToDateInput(platformLaunchAt);
  const today = epochToDateInput(now);
  const isCustom = activeKey === "custom";

  // Today and All time always show; the active preset always shows (so it's
  // never hidden out from under the user). Rolling presets show only once we
  // know the history is long enough — which also prevents them flashing in
  // before the real launch date has loaded.
  const visiblePresets = PRESETS.filter((p) => {
    if (p.key === activeKey) return true;
    if (p.days == null || p.days === 0) return true;
    return historyKnown && p.days <= maxDays;
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-4">
        <SegmentedControl label="Time range" className="flex-wrap">
          {visiblePresets.map((p) => (
            <SegmentButton
              key={p.key}
              active={activeKey === p.key}
              title={p.title}
              onClick={() => onPreset(p.key)}
            >
              {p.label}
            </SegmentButton>
          ))}
          <SegmentButton
            active={isCustom}
            title="Pick exact start and end dates"
            onClick={() => onPreset("custom")}
          >
            Custom
          </SegmentButton>
        </SegmentedControl>

        {isCustom && (
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
                onChange={(e) => {
                  const stop = dateInputToEpochEnd(e.target.value);
                  if (stop != null) onCustomRange({ start: Math.min(range.start, stop), stop });
                }}
                className="h-11 w-[10.5rem] text-base md:h-9 md:text-sm"
                aria-label="Range end date"
              />
            </label>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {formatDate(range.start)} – {formatDate(range.stop)}
        {effectiveGranularity ? ` · by ${effectiveGranularity}` : ""}
      </p>
    </div>
  );
}
