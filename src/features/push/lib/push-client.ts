import {
  getPushConfig,
  registerPushSubscription,
  deletePushSubscription,
} from "./push-api";
import type {
  PushPermission,
  PushResult,
  PushStateSnapshot,
} from "@/types/push";

const SW_URL = "/sw.js";
const SW_SCOPE = "/";

/**
 * True only when the browser exposes the full web-push stack. iOS Safari
 * gates `PushManager` behind an installed PWA (Add to Home Screen, 16.4+),
 * so this also doubles as the "can we even offer push?" check.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Decode a base64url VAPID public key into the `Uint8Array` that
 * `pushManager.subscribe({ applicationServerKey })` requires.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Back the view with a concrete ArrayBuffer (not ArrayBufferLike) so it
  // satisfies the `BufferSource` type expected by `applicationServerKey`.
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * Read the device's current push capability + subscription state without
 * prompting or mutating anything. Safe to call on mount.
 */
export async function getPushState(): Promise<PushStateSnapshot> {
  if (!isPushSupported()) {
    return { isSupported: false, permission: "unsupported", isSubscribed: false };
  }

  const permission = Notification.permission as PushPermission;
  let isSubscribed = false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    isSubscribed = Boolean(subscription);
  } catch {
    // A failed lookup just means "we can't confirm a subscription" — treat
    // as not subscribed rather than throwing into the UI.
  }
  return { isSupported: true, permission, isSubscribed };
}

/** Reuse an existing registration or register the SW on demand. */
async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

/**
 * Subscribe (or reuse) the browser push subscription against the backend's
 * VAPID key, then register it with `POST /v1/push/subscriptions`.
 * Provider-agnostic: bails cleanly if the backend reports a provider this
 * client can't initialise.
 */
async function subscribeAndRegister(
  registration: ServiceWorkerRegistration,
): Promise<PushResult> {
  const config = await getPushConfig();
  if (config.provider !== "webpush" || !config.publicKey) {
    // A future provider (e.g. fcm) would init its own SDK from config.params;
    // until that exists, there's nothing to subscribe to here.
    return { ok: false, reason: "unsupported-provider" };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  await registerPushSubscription(subscription.toJSON());
  return { ok: true };
}

/**
 * Full enable flow, driven by an explicit user action (the settings
 * toggle). Requests permission if still "default", registers the SW,
 * subscribes, and POSTs the subscription. Returns a typed result so the
 * caller can surface the right copy on each failure mode.
 */
export async function enablePush(): Promise<PushResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return {
      ok: false,
      reason: permission === "denied" ? "denied" : "dismissed",
    };
  }

  try {
    const registration = await ensureRegistration();
    await navigator.serviceWorker.ready;
    return await subscribeAndRegister(registration);
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Full disable flow. Removes the backend row first (while cookies are
 * still valid) so a failed DELETE never orphans a server-side
 * subscription, then unsubscribes the browser.
 */
export async function disablePush(): Promise<PushResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      try {
        await deletePushSubscription(subscription.endpoint);
      } catch {
        // Best-effort: the backend auto-prunes dead rows on next send, so a
        // failed DELETE shouldn't block the local unsubscribe.
      }
      await subscription.unsubscribe();
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Silent re-subscribe on login. NEVER prompts: only runs when permission
 * was already granted. Re-POSTs the (possibly rotated) subscription so the
 * backend row stays fresh and re-points to the current user on a shared
 * device — exactly the "POST on every login" the backend guide recommends.
 */
export async function refreshPushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    // No registration yet (e.g. dev where the SW isn't registered) → nothing
    // to refresh. The user can still enable push from settings.
    if (!registration) return;
    await subscribeAndRegister(registration);
  } catch {
    // Best-effort — a missing refresh is recovered next time enablePush runs.
  }
}
