import { format, formatDistanceToNow, fromUnixTime } from "date-fns";

/**
 * Format a Unix epoch timestamp to a readable date string.
 */
export function formatDate(epochSeconds: number, pattern = "MMM d, yyyy"): string {
  return format(fromUnixTime(epochSeconds), pattern);
}

/**
 * Format a Unix epoch timestamp to a date-time string.
 */
export function formatDateTime(epochSeconds: number): string {
  return format(fromUnixTime(epochSeconds), "MMM d, yyyy h:mm a");
}

/**
 * Format a Unix epoch timestamp as relative time (e.g., "5 minutes ago").
 */
export function formatRelative(epochSeconds: number): string {
  return formatDistanceToNow(fromUnixTime(epochSeconds), { addSuffix: true });
}
