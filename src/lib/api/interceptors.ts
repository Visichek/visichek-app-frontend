import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { getAccessToken, getSessionType } from "@/lib/auth/tokens";
import { refreshSession, clearSession } from "@/lib/auth/session";
import { ApiError, type ErrorEnvelope } from "@/types/api";

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

export function setupInterceptors(client: AxiosInstance) {
  // ── Request: inject auth header ───────────────────────────────────
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
      };

      // If not a 401 or already retried, normalize and reject
      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(normalizeError(error));
      }

      // Check if we have a session type — needed to pick the right refresh endpoint.
      // The actual refresh token is in the httpOnly cookie (sent automatically).
      // In-memory refresh token is a bonus but not required.
      const sessionType = getSessionType();

      if (!sessionType) {
        clearSession();
        return Promise.reject(normalizeError(error));
      }

      if (isRefreshing) {
        // Queue this request while refresh is in-flight
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(client(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await refreshSession();
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
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

  // 403 → always surface a clear permissions message
  const message =
    status === 403
      ? "Insufficient permissions — you do not have access to this feature."
      : envelope?.message || error.message || "An unexpected error occurred";

  const code =
    status === 403
      ? envelope?.data?.code || "FORBIDDEN"
      : envelope?.data?.code || `HTTP_${status}`;

  return new ApiError({
    message,
    code,
    status,
    details: envelope?.data?.details,
    requestId: envelope?.requestId,
  });
}
