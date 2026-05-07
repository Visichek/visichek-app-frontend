/**
 * Server-only HTTP client. Do NOT import from client components — the
 * client axios instance in `./client.ts` handles the browser side.
 */
import type { ApiEnvelope, ErrorEnvelope } from "@/types/api";
import { ApiError } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.visichek.app/v1";

// Hard cap for server-side prefetches. SSR helpers are best-effort — when the
// API is slow or unreachable from the Next.js server, we'd rather skip the
// prefetch and let the client hooks fetch normally than hang the page render
// (which would leave the user stuck on loading.tsx forever during navigation).
const SERVER_FETCH_TIMEOUT_MS = 2000;

export interface ServerFetchOptions {
  /** Access token to attach as Authorization: Bearer ... */
  accessToken?: string | null;
  /** Extra cookies to forward (e.g. from next/headers cookies()) */
  cookieHeader?: string | null;
  /** Query params object (converted to URLSearchParams) */
  params?: Record<string, unknown>;
  /** Override response-case header if needed */
  responseCase?: "camel" | "snake";
  /** Passthrough to fetch (e.g. cache, next.revalidate) */
  next?: RequestInit["next"];
  cache?: RequestInit["cache"];
  /** Override the default 2s timeout. Pass 0 to disable. */
  timeoutMs?: number;
}

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null
  );
  if (!entries.length) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.append(k, String(v));
  return `?${usp.toString()}`;
}

async function parseEnvelope<T>(response: Response, url: string): Promise<T> {
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response — treat as opaque error
  }

  if (response.ok && envelope && "success" in envelope && envelope.success) {
    return envelope.data;
  }

  const errorEnvelope = envelope as ErrorEnvelope | null;
  throw new ApiError({
    message: errorEnvelope?.message ?? `Server request failed: ${url}`,
    code: errorEnvelope?.data?.code ?? `HTTP_${response.status}`,
    status: response.status,
    details: errorEnvelope?.data?.details,
    requestId: errorEnvelope?.requestId,
  });
}

function buildSignal(timeoutMs: number | undefined): AbortSignal | undefined {
  const ms = timeoutMs ?? SERVER_FETCH_TIMEOUT_MS;
  if (ms <= 0) return undefined;
  return AbortSignal.timeout(ms);
}

export async function serverApiGet<T>(
  path: string,
  options: ServerFetchOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQueryString(options.params)}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Response-Case": options.responseCase ?? "camel",
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.cookieHeader) {
    headers.Cookie = options.cookieHeader;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: options.cache ?? "no-store",
    next: options.next,
    signal: buildSignal(options.timeoutMs),
  });

  return parseEnvelope<T>(response, url);
}

export async function serverApiPost<T>(
  path: string,
  body?: unknown,
  options: ServerFetchOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQueryString(options.params)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Response-Case": options.responseCase ?? "camel",
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.cookieHeader) {
    headers.Cookie = options.cookieHeader;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: buildSignal(options.timeoutMs),
  });

  return parseEnvelope<T>(response, url);
}
