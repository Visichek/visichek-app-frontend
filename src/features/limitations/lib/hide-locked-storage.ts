/**
 * Per-device "hide locked items" preference.
 *
 * Free-plan tenants see a lot of padlocks across the app — locked nav
 * rows, locked dashboard tiles, locked settings sections. This
 * preference lets the user collapse all of that out of their UI while
 * they focus on the features their plan actually grants. Critically:
 *
 *   - Local-only. Never synced. We never PATCH this anywhere; it lives
 *     in `localStorage` and goes away when the user clears site data.
 *   - Auto-expires after 4 hours so the upgrade affordance never goes
 *     missing forever. On the next read after the TTL, we clear the
 *     stored value and surface a one-shot `justExpired` flag the UI
 *     uses to toast the user — "Locked items are visible again. Toggle
 *     again to hide them."
 *   - Opt-in. Default state is "show locked items" — the existing UX.
 *
 * The storage key is versioned so a future schema change doesn't have
 * to worry about migrating stale payloads.
 */

const STORAGE_KEY = "visichek-hide-locked-v1";

/** TTL after which the preference auto-disables itself. */
export const HIDE_LOCKED_TTL_MS = 4 * 60 * 60 * 1000;

/**
 * Event fired on the `window` whenever the value is mutated. React
 * subscribers in the same tab use this to re-read the snapshot without
 * waiting on the next render; the cross-tab `storage` event handles
 * other tabs for free.
 */
export const HIDE_LOCKED_EVENT = "visichek:hide-locked-changed";

export interface HideLockedSnapshot {
  enabled: boolean;
  /**
   * True only when this read happened to be the one that crossed the
   * 4-hour TTL and tripped the auto-disable. The UI uses this to fire
   * the "Locked items are visible again" toast exactly once.
   */
  justExpired: boolean;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

interface StoredPayload {
  enabled?: unknown;
  savedAt?: unknown;
}

export function readHideLockedSnapshot(): HideLockedSnapshot {
  if (!isBrowser()) return { enabled: false, justExpired: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, justExpired: false };
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed?.enabled !== true || typeof parsed.savedAt !== "number") {
      window.localStorage.removeItem(STORAGE_KEY);
      return { enabled: false, justExpired: false };
    }
    if (Date.now() - parsed.savedAt > HIDE_LOCKED_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return { enabled: false, justExpired: true };
    }
    return { enabled: true, justExpired: false };
  } catch {
    return { enabled: false, justExpired: false };
  }
}

export function writeHideLocked(enabled: boolean): void {
  if (!isBrowser()) return;
  try {
    if (enabled) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ enabled: true, savedAt: Date.now() }),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(HIDE_LOCKED_EVENT));
  } catch {
    /* CustomEvent unavailable — best-effort only */
  }
}
