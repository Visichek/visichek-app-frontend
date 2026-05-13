import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { refreshSession, clearSession } from "@/lib/auth/session";
import { isLogoutTransitionActive } from "@/lib/auth/auth-transition";
import { peekUserLocationHeader } from "@/lib/geolocation/user-location";
import { ApiError, type ErrorEnvelope } from "@/types/api";

/**
 * Axios interceptors. Auth tokens live in httpOnly cookies set by the
 * backend; every request goes out with `withCredentials: true` (configured
 * on the client) so the cookies travel automatically. The frontend never
 * reads, writes, or attaches a token itself.
 */

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  failedQueue = [];
}

export function setupInterceptors(client: AxiosInstance) {
  // ── Request: piggyback geolocation, clean up FormData content-type ──
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    // Authenticated requests piggyback the user's current geolocation
    // (if the browser has granted permission) as `X-User-Location`.
    // The backend reads this inside the gate-check dependency and
    // fire-and-forget-writes it to Redis with a 10-min TTL so the
    // geofencing service can answer "which approvers are on-site?".
    //
    // Rules:
    //   - Omit the header entirely if no sample is cached — the server
    //     treats a missing header as "no recent location", which is
    //     exactly what we want.
    //   - Never block the request on a geolocation read; we only
    //     attach what's already cached in memory.
    if (config.headers) {
      const locationHeader = peekUserLocationHeader();
      if (locationHeader) {
        config.headers["X-User-Location"] = locationHeader;
      }
    }

    // When the caller passes a FormData body, clear the default
    // `Content-Type: application/json` so the browser can set
    // `multipart/form-data; boundary=...` itself. Axios 1.x will otherwise
    // serialise the FormData to JSON when it sees a JSON content-type,
    // which breaks FastAPI's multipart parser (every Form(...) field
    // arrives missing → 422).
    if (typeof FormData !== "undefined" && config.data instanceof FormData && config.headers) {
      config.headers.delete?.("Content-Type");
      delete (config.headers as Record<string, unknown>)["Content-Type"];
    }

    return config;
  });

  // ── Response: unwrap envelope, handle 401 refresh ─────────────────
  client.interceptors.response.use(
    (response) => {
      // Unwrap the success envelope — return just the data payload.
      //
      // This branch also handles the `202 Accepted` queued-write contract:
      // axios treats any 2xx as success, so a 202 with body
      //   { success: true, data: { id, jobId, status: "queued" }, ... }
      // resolves to `{ id, jobId, status }` as the caller's data. From here
      // it's up to the calling hook (see `enqueueAndConfirm` /
      // `useAsyncMutation`) to poll GET /v1/jobs/{jobId} for the terminal
      // state. Do not special-case 202 here.
      if (response.data?.success === true) {
        return {
          ...response,
          data: response.data.data,
          meta: response.data.meta,
          message: response.data.message,
        };
      }
      return response;
    },
    async (error: AxiosError<ErrorEnvelope>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
        skipAuthRefresh?: boolean;
      };

      if (
        error.response?.status !== 401 ||
        originalRequest._retry ||
        originalRequest.skipAuthRefresh ||
        isLogoutTransitionActive()
      ) {
        return Promise.reject(normalizeError(error));
      }

      if (isRefreshing) {
        // Queue this request while a refresh is in-flight; on success
        // we replay it and the rotated cookies travel automatically.
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(client(originalRequest)),
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await refreshSession();
        processQueue(null);
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        clearSession();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );
}

function normalizeError(error: AxiosError<ErrorEnvelope>): ApiError {
  const response = error.response;
  const envelope = response?.data;
  const status = response?.status || 0;
  const backendCode = envelope?.data?.code;

  // 403 → default to the generic permissions message, but let a few
  // well-known backend codes carry their own explanation. Geofence
  // rejections, for example, include a distance/radius in the body that
  // is useful to the visitor — burying it under "insufficient
  // permissions" makes the kiosk unfixable from the user's side.
  const preserveBackendMessage =
    status === 403 && backendCode === "GEOFENCE_VIOLATION";

  const message =
    status === 403 && !preserveBackendMessage
      ? "Insufficient permissions — you do not have access to this feature."
      : extractCleanMessage(envelope) || error.message || "An unexpected error occurred";

  const code =
    status === 403
      ? backendCode || "FORBIDDEN"
      : backendCode || `HTTP_${status}`;

  return new ApiError({
    message,
    code,
    status,
    details: envelope?.data?.details,
    requestId: envelope?.requestId,
  });
}

/**
 * Pull a user-facing sentence out of an error body. Some backend paths
 * return the standard `{ message }` envelope, but a few stringify a
 * structured payload (FastAPI `HTTPException(detail=...)` with a dict)
 * which arrives as `"400: {'message': '...', 'code': '...', ...}"` —
 * dumping that whole repr in a toast is unreadable.
 */
function extractCleanMessage(envelope: unknown): string | undefined {
  if (!envelope || typeof envelope !== "object") return undefined;
  const e = envelope as Record<string, unknown>;

  const candidates: unknown[] = [e.message, e.detail];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const inner = parseInnerMessage(candidate);
      if (inner) return inner;
      if (candidate.trim()) return candidate;
    } else if (candidate && typeof candidate === "object") {
      const nested = (candidate as Record<string, unknown>).message;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
  }
  return undefined;
}

function parseInnerMessage(raw: string): string | undefined {
  // Match `'message': '...'` (Python repr) or `"message": "..."` (JSON-ish),
  // tolerating escaped quotes inside the value.
  const single = raw.match(/'message'\s*:\s*'((?:[^'\\]|\\.)*)'/);
  if (single) return single[1];
  const double = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (double) return double[1];
  return undefined;
}
