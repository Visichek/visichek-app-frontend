import {
  getUnixTime,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
} from "date-fns";
import type { Granularity } from "@/types/insights";

/**
 * Range presets the picker offers. Each resolves to a `{ start, stop }` pair
 * in unix seconds; the server clamps `start` up to the tenant creation date
 * and echoes the effective window back in `meta.appliedRange`.
 */
export type RangePresetKey =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "quarter"
  | "year"
  | "all"
  | "custom";

export interface DateRange {
  start: number;
  stop: number;
}

export const RANGE_PRESETS: Array<{ key: RangePresetKey; label: string; hint: string }> = [
  { key: "today", label: "Today", hint: "Activity since midnight today" },
  { key: "7d", label: "7d", hint: "The last 7 days" },
  { key: "30d", label: "30d", hint: "The last 30 days" },
  { key: "90d", label: "90d", hint: "The last 90 days" },
  { key: "month", label: "This month", hint: "From the 1st of this month to now" },
  { key: "quarter", label: "This quarter", hint: "From the start of this quarter to now" },
  { key: "year", label: "This year", hint: "From Jan 1 to now" },
  { key: "all", label: "All time", hint: "Everything since your account was created" },
  { key: "custom", label: "Custom", hint: "Pick an exact start and end date" },
];

/**
 * Resolve a preset to a concrete window. `all` starts at the tenant creation
 * date; the server clamps everything else to tenure anyway.
 */
export function resolvePreset(
  key: Exclude<RangePresetKey, "custom">,
  tenantCreatedAt: number,
  now: Date = new Date(),
): DateRange {
  const stop = getUnixTime(now);
  switch (key) {
    case "today":
      return { start: getUnixTime(startOfDay(now)), stop };
    case "7d":
      return { start: getUnixTime(startOfDay(subDays(now, 6))), stop };
    case "30d":
      return { start: getUnixTime(startOfDay(subDays(now, 29))), stop };
    case "90d":
      return { start: getUnixTime(startOfDay(subDays(now, 89))), stop };
    case "month":
      return { start: getUnixTime(startOfMonth(now)), stop };
    case "quarter":
      return { start: getUnixTime(startOfQuarter(now)), stop };
    case "year":
      return { start: getUnixTime(startOfYear(now)), stop };
    case "all":
      return { start: tenantCreatedAt, stop };
  }
}

/** Mirror of the server's auto-granularity rule (for display hints only). */
export function autoGranularity(start: number, stop: number): Granularity {
  const hours = (stop - start) / 3_600;
  if (hours <= 48) return "hour";
  const days = hours / 24;
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

/** Unix seconds -> "YYYY-MM-DD" for a native <input type="date"> value. */
export function epochToDateInput(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** "YYYY-MM-DD" (local) -> unix seconds at start of that day. */
export function dateInputToEpoch(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000);
}

/** "YYYY-MM-DD" (local) -> unix seconds at the END of that day (23:59:59). */
export function dateInputToEpochEnd(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(new Date(y, m - 1, d, 23, 59, 59, 0).getTime() / 1000);
}
