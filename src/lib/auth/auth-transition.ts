"use client";

const EXPLICIT_LOGOUT_KEY = "visichek-explicit-logout-at";
const EXPLICIT_LOGOUT_SUPPRESS_MS = 15_000;

let logoutInFlight = false;

function now(): number {
  return Date.now();
}

export function beginLogoutTransition(): void {
  logoutInFlight = true;
}

export function finishLogoutTransition(): void {
  logoutInFlight = false;
}

export function isLogoutTransitionActive(): boolean {
  return logoutInFlight;
}

export function markExplicitLogout(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, String(now()));
}

export function clearExplicitLogout(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
}

export function shouldSuppressAuthRehydrate(): boolean {
  if (logoutInFlight) return true;
  if (typeof window === "undefined") return false;

  const raw = window.sessionStorage.getItem(EXPLICIT_LOGOUT_KEY);
  if (!raw) return false;

  const loggedOutAt = Number(raw);
  if (!Number.isFinite(loggedOutAt)) {
    clearExplicitLogout();
    return false;
  }

  if (now() - loggedOutAt > EXPLICIT_LOGOUT_SUPPRESS_MS) {
    clearExplicitLogout();
    return false;
  }

  return true;
}
