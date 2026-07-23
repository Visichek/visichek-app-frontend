/**
 * Shared display + filter helpers for audit / activity views
 * (My activity, tenant Audit log, Recent activity).
 */

import type { FilterOption } from "@/components/recipes/filter-bar";

/** Render `incident.create` as a readable "Incident · Create". */
export function readableAction(action: string): string {
  if (!action) return "—";
  return action
    .split(".")
    .map((part) =>
      part
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    )
    .join(" · ");
}

export function operationVariant(action: string) {
  if (action.endsWith(".delete") || action.includes("erase") || action.endsWith(".rejected") || action.endsWith(".denied"))
    return "destructive" as const;
  if (action.endsWith(".create") || action.endsWith(".created") || action.endsWith(".approved"))
    return "success" as const;
  if (action.endsWith(".update") || action.endsWith(".updated")) return "info" as const;
  return "secondary" as const;
}

/**
 * Compact, human-readable one-liner for an audit row's `details` payload.
 * Notes and reasons lead (that's what staff look for); everything else is
 * appended as `key: value` pairs, skipping internal plumbing keys.
 */
export function auditDetailsText(
  details: Record<string, unknown> | null | undefined,
): string {
  if (!details || typeof details !== "object") return "";
  const SKIP = new Set(["task_id", "request_id"]);
  const LEAD = ["notes", "reason", "rejection_reason", "resolution"];
  const parts: string[] = [];
  for (const key of LEAD) {
    const v = details[key];
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
  }
  for (const [key, value] of Object.entries(details)) {
    if (SKIP.has(key) || LEAD.includes(key)) continue;
    if (value === null || value === undefined || value === "") continue;
    const text =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    parts.push(`${key.replace(/_/g, " ")}: ${text}`);
  }
  return parts.join(" · ");
}

export const AUDIT_OPERATION_OPTIONS: FilterOption[] = [
  { label: "Create", value: "create" },
  { label: "Read", value: "read" },
  { label: "Update", value: "update" },
  { label: "Delete", value: "delete" },
];

/** Resource types that appear in tenant audit rows. */
export const AUDIT_RESOURCE_TYPE_OPTIONS: FilterOption[] = [
  { label: "Check-in", value: "checkin" },
  { label: "Visit session", value: "visit_session" },
  { label: "Visitor profile", value: "visitor_profile" },
  { label: "Appointment", value: "appointment" },
  { label: "Department", value: "department" },
  { label: "Branch", value: "branch" },
  { label: "Branding", value: "branding" },
  { label: "Data subject request", value: "dsr" },
  { label: "Incident", value: "incident" },
  { label: "Support case", value: "support_case" },
  { label: "User", value: "system_user" },
  { label: "User location", value: "user_location" },
  { label: "Organization settings", value: "tenant_settings" },
  { label: "Subscription", value: "subscription" },
];

export const AUDIT_RANGE_OPTIONS: FilterOption[] = [
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

/** Map a range option value to a unix-seconds `timestampGte`. */
export function rangeToTimestampGte(range: string): number {
  const now = Math.floor(Date.now() / 1000);
  const seconds: Record<string, number> = {
    "24h": 86400,
    "7d": 7 * 86400,
    "30d": 30 * 86400,
    "90d": 90 * 86400,
  };
  return now - (seconds[range] ?? 30 * 86400);
}
