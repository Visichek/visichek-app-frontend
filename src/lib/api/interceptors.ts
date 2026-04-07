import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { getAccessToken, getRefreshToken, getSessionType } from "@/lib/auth/tokens";
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
      // Unwrap the success envelope — return just the data payload
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

      // Attempt token refresh
      const refreshToken = getRefreshToken();
      const sessionType = getSessionType();

      if (!refreshToken || !sessionType) {
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

  return new ApiError({
    message: envelope?.message || error.message || "An unexpected error occurred",
    code: envelope?.data?.code || `HTTP_${response?.status || 0}`,
    status: response?.status || 0,
    details: envelope?.data?.details,
    requestId: envelope?.requestId,
  });
}
