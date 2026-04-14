import axios from "axios";
import { setupInterceptors } from "./interceptors";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.visichek.app/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send httpOnly cookies on every request
  timeout: 30_000,
});

// Attach auth header injection, 401 refresh, and error normalization
setupInterceptors(apiClient);

export default apiClient;
