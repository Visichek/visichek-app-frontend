import type { JobRecord } from "@/types/job";

const EXCEPTION_PREFIX = /^[A-Z][A-Za-z]*(?:Error|Exception):\s*/;

/**
 * Strip the Python exception class prefix from a queued-write error string.
 *
 * The backend returns `error` as a short summary like
 * `"AppException: Department name already exists"` or
 * `"ValueError: Invalid phone number"`. Users shouldn't see the class name, so
 * we strip the leading `<ClassName>:` fragment.
 */
export function parseJobError(
  job: JobRecord | null | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = job?.error;
  if (!raw) return fallback;
  return raw.replace(EXCEPTION_PREFIX, "").trim() || fallback;
}

/**
 * Same rule, but accepts a bare string (handy when all you have is the
 * notification body or a toast payload).
 */
export function stripExceptionPrefix(message: string): string {
  return message.replace(EXCEPTION_PREFIX, "").trim();
}

/**
 * Pretty-print a writer task key (e.g. `"db.write:department.create"` →
 * `"Department create"`) for use in job log tables / detail headings.
 */
export function formatTaskKey(taskKey: string | undefined | null): string {
  if (!taskKey) return "Unknown task";
  const body = taskKey.replace(/^db\.write:/, "");
  if (!body) return taskKey;
  const [resource, action] = body.split(".");
  const niceResource = resource
    ? resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, " ")
    : body;
  if (!action) return niceResource;
  return `${niceResource} · ${action}`;
}
