import axios from "axios";
import { setupInterceptors } from "./interceptors";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

// Attach auth header injection, 401 refresh, and error normalization
setupInterceptors(apiClient);

export default apiClient;
