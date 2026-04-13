import { format, formatDistanceToNow, fromUnixTime } from "date-fns";

/**
 * Format a Unix epoch timestamp to a readable date string.
 */
export function formatDate(epochSeconds: number | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!isValidEpoch(epochSeconds)) return "—";
  return format(fromUnixTime(epochSeconds as number), pattern);
}

/**
 * Format a Unix epoch timestamp to a date-time string.
 */
export function formatDateTime(epochSeconds: number | null | undefined): string {
  if (!isValidEpoch(epochSeconds)) return "—";
  return format(fromUnixTime(epochSeconds as number), "MMM d, yyyy h:mm a");
}

/**
 * Format a Unix epoch timestamp as relative time (e.g., "5 minutes ago").
 */
export function formatRelative(epochSeconds: number | null | undefined): string {
  if (!isValidEpoch(epochSeconds)) return "—";
  return formatDistanceToNow(fromUnixTime(epochSeconds as number), { addSuffix: true });
}

function isValidEpoch(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
