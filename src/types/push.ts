// ── Web Push Types ────────────────────────────────────────────────────
//
// Mirrors the backend push contract (GET /v1/push/config,
// POST/DELETE /v1/push/subscriptions). The transport is provider-agnostic
// on the backend — the frontend branches on `provider` rather than
// assuming VAPID — so a future provider (e.g. FCM) can return its own
// init data under `params` instead of `publicKey`.

export type PushProvider = "webpush" | "fcm";

/**
 * Response from `GET /v1/push/config`. Fetch once before subscribing.
 * For `provider === "webpush"`, `publicKey` is the VAPID application
 * server key (base64url) passed to `pushManager.subscribe`. The key can
 * be rotated server-side, so it must never be hardcoded in the bundle.
 */
export interface PushConfig {
  provider: PushProvider;
  publicKey?: string;
  params?: Record<string, unknown>;
}

/** Response `data` from `POST /v1/push/subscriptions`. Idempotent register. */
export interface PushSubscriptionAck {
  id: string;
  endpoint: string;
}

/** Response `data` from `DELETE /v1/push/subscriptions`. */
export interface PushUnsubscribeAck {
  /** Rows removed: 1 if the endpoint was registered, 0 otherwise. */
  removed: number;
}

/**
 * Why a subscribe/unsubscribe attempt did not complete. Used to drive
 * user-facing copy in the settings UI.
 *
 * - `unsupported`          — no Service Worker / PushManager / Notification API
 * - `denied`               — the user blocked notifications in the browser
 * - `dismissed`            — the permission prompt was dismissed (still "default")
 * - `unsupported-provider` — backend returned a provider the client can't init
 * - `error`                — network / subscribe failure
 */
export type PushFailureReason =
  | "unsupported"
  | "denied"
  | "dismissed"
  | "unsupported-provider"
  | "error";

export type PushResult = { ok: true } | { ok: false; reason: PushFailureReason };

/** Permission state, widened with `unsupported` for capability-less browsers. */
export type PushPermission = NotificationPermission | "unsupported";

/** Snapshot of the current device's push capability + subscription state. */
export interface PushStateSnapshot {
  isSupported: boolean;
  permission: PushPermission;
  isSubscribed: boolean;
}
