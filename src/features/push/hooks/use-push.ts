"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  disablePush,
  enablePush,
  getPushState,
  refreshPushSubscription,
} from "../lib/push-client";
import type { PushPermission, PushResult } from "@/types/push";

export interface UsePushSubscription {
  /** Browser exposes the full Service Worker + PushManager + Notification stack. */
  isSupported: boolean;
  /** Notification permission, or "unsupported" on capability-less browsers. */
  permission: PushPermission;
  /** This device currently holds a push subscription. */
  isSubscribed: boolean;
  /** An enable/disable flow is in flight. */
  isBusy: boolean;
  /** Prompt (if needed), subscribe, and register the device. */
  enable: () => Promise<PushResult>;
  /** Unregister and unsubscribe the device. */
  disable: () => Promise<PushResult>;
  /** Re-read capability + subscription state from the browser. */
  refresh: () => Promise<void>;
}

/**
 * Device-level push subscription state for the settings UI. Owns ONLY the
 * browser subscription + backend registration — preference persistence
 * (user settings, server-side `pushEnabled` gate) is orchestrated by the
 * caller, so this hook stays reusable (e.g. login-time silent refresh).
 */
export function usePushSubscription(): UsePushSubscription {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  // Guard state writes after unmount — the async flows can outlive the tab.
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const state = await getPushState();
    if (!mountedRef.current) return;
    setIsSupported(state.isSupported);
    setPermission(state.permission);
    setIsSubscribed(state.isSubscribed);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const enable = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await enablePush();
      await refresh();
      return result;
    } finally {
      if (mountedRef.current) setIsBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await disablePush();
      await refresh();
      return result;
    } finally {
      if (mountedRef.current) setIsBusy(false);
    }
  }, [refresh]);

  return { isSupported, permission, isSubscribed, isBusy, enable, disable, refresh };
}

/**
 * Fire a one-shot silent re-subscribe when an authenticated shell mounts.
 * No-ops unless push is supported AND already permitted, so it never
 * prompts — it just keeps the backend subscription fresh / re-points it to
 * the current user after login. Mount inside a post-auth shell.
 */
export function usePushAutoRefresh(): void {
  useEffect(() => {
    void refreshPushSubscription();
  }, []);
}
