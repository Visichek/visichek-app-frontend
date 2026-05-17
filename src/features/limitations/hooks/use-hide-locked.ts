"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HIDE_LOCKED_EVENT,
  HIDE_LOCKED_TTL_MS,
  readHideLockedSnapshot,
  writeHideLocked,
  type HideLockedSnapshot,
} from "../lib/hide-locked-storage";

/**
 * Subscribe to the per-device hide-locked preference. Re-reads the
 * stored value when:
 *   - the same tab toggles it (`HIDE_LOCKED_EVENT` from the storage helper)
 *   - another tab toggles it (the native `storage` event)
 *   - one minute has passed, so the 4-hour TTL eventually trips even
 *     when the tab stays open without other activity
 *
 * Returns a snapshot, NOT just `enabled`, so the caller can also see
 * the one-shot `justExpired` flag for surfacing the expiry toast.
 */
function useHideLockedSnapshot(): HideLockedSnapshot {
  const [snapshot, setSnapshot] = useState<HideLockedSnapshot>(() =>
    readHideLockedSnapshot(),
  );

  useEffect(() => {
    const reread = () => {
      const next = readHideLockedSnapshot();
      setSnapshot((prev) =>
        prev.enabled === next.enabled && prev.justExpired === next.justExpired
          ? prev
          : next,
      );
    };
    window.addEventListener(HIDE_LOCKED_EVENT, reread);
    window.addEventListener("storage", reread);
    const interval = window.setInterval(reread, 60_000);
    return () => {
      window.removeEventListener(HIDE_LOCKED_EVENT, reread);
      window.removeEventListener("storage", reread);
      window.clearInterval(interval);
    };
  }, []);

  return snapshot;
}

export interface UseHideLockedResult {
  /** True when locked padlock UI should be hidden on this device. */
  hideLocked: boolean;
  setHideLocked: (next: boolean) => void;
  /**
   * One-shot flag that flips true on the read where the 4-hour TTL
   * expired and the preference auto-disabled itself. The single
   * `HideLockedExpiryToast` component reads this to fire its toast,
   * then calls `acknowledgeExpiry()` to suppress further toasts in this
   * session.
   */
  justExpired: boolean;
  acknowledgeExpiry: () => void;
  /** Exposed for copy / debug. */
  ttlMs: number;
}

/**
 * Components that just want to know "should I hide this padlocked
 * thing" call `useHideLocked()` and read `hideLocked`. The expiry
 * toast logic is owned by `<HideLockedExpiryToast />` (mounted once
 * in the tenant shell) so we never fire the same toast twice from
 * different subscribers.
 */
export function useHideLocked(): UseHideLockedResult {
  const { enabled, justExpired } = useHideLockedSnapshot();
  const [acknowledged, setAcknowledged] = useState(false);

  // Re-arm the acknowledgement window every time the source flips
  // back to "not expired" (i.e. the user re-enabled the pref, or a
  // fresh tab loaded a stored value that hasn't tripped TTL yet).
  // Without this, a second TTL expiry in the same tab session would
  // be silently swallowed.
  useEffect(() => {
    if (!justExpired) setAcknowledged(false);
  }, [justExpired]);

  const setHideLocked = useCallback((next: boolean) => {
    writeHideLocked(next);
  }, []);

  const acknowledgeExpiry = useCallback(() => {
    setAcknowledged(true);
  }, []);

  return {
    hideLocked: enabled,
    setHideLocked,
    justExpired: justExpired && !acknowledged,
    acknowledgeExpiry,
    ttlMs: HIDE_LOCKED_TTL_MS,
  };
}
