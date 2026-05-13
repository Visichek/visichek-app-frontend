import { store } from "@/lib/store";

export const POLLING_INTERVALS = {
  activeVisitors: 5_000,
  awaitingCheckout: 5_000,
  jobsList: 5_000,
  jobDetail: 1_000,
  notifications: 30_000,
  dashboardStats: 30_000,
  approachingIncidents: 60_000,
} as const;

export function isPollingAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return store.getState().session.isAuthenticated;
}

export function pollWhenAuthenticated(intervalMs: number): number | false {
  return isPollingAllowed() ? intervalMs : false;
}
