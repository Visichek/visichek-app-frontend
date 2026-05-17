"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useHideLocked } from "../hooks/use-hide-locked";

/**
 * Mounted once at the tenant shell root. Watches the hide-locked
 * preference for the auto-expiry flip and fires a one-time toast so
 * the user knows the upgrade affordances reappeared. After the toast
 * fires we call `acknowledgeExpiry()` so re-renders never replay the
 * same notice in this session.
 */
export function HideLockedExpiryToast() {
  const { justExpired, acknowledgeExpiry } = useHideLocked();

  useEffect(() => {
    if (!justExpired) return;
    toast("Locked items are visible again", {
      description:
        "The hide-locked setting auto-resets every 4 hours. Open your account menu to hide them again.",
      duration: 8000,
    });
    acknowledgeExpiry();
  }, [justExpired, acknowledgeExpiry]);

  return null;
}
