import apiClient from "./client";
import type { AxiosRequestConfig } from "axios";

/**
 * Typed GET request. The response is already unwrapped by the interceptor.
 */
export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown> | object,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.get<T>(url, { ...config, params });
  return response.data;
}

/**
 * Typed POST request.
 */
export async function apiPost<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

/**
 * Typed PUT request.
 */
export async function apiPut<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.put<T>(url, data, config);
  return response.data;
}

/**
 * Typed PATCH request.
 */
export async function apiPatch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.patch<T>(url, data, config);
  return response.data;
}

/**
 * Typed DELETE request.
 */
export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}
