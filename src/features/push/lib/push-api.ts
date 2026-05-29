import { apiGet, apiPost, apiDelete } from "@/lib/api/request";
import type {
  PushConfig,
  PushSubscriptionAck,
  PushUnsubscribeAck,
} from "@/types/push";

/**
 * Push API module. Every call rides the shared axios client, so cookies
 * travel automatically (`withCredentials`) and the response envelope is
 * unwrapped by the interceptor — these helpers see the `data` payload
 * directly. Never construct an Authorization header here.
 */

/** `GET /v1/push/config` — provider + public key needed to subscribe. */
export function getPushConfig(): Promise<PushConfig> {
  return apiGet<PushConfig>("/push/config");
}

/**
 * `POST /v1/push/subscriptions` — register (or refresh) this device.
 * Idempotent: re-posting the same endpoint just refreshes the row. Body
 * is the browser `PushSubscription.toJSON()` verbatim.
 */
export function registerPushSubscription(
  subscription: PushSubscriptionJSON,
): Promise<PushSubscriptionAck> {
  return apiPost<PushSubscriptionAck>("/push/subscriptions", subscription);
}

/**
 * `DELETE /v1/push/subscriptions` — remove this device's subscription.
 * Axios carries the body on DELETE via `config.data`.
 */
export function deletePushSubscription(
  endpoint: string,
): Promise<PushUnsubscribeAck> {
  return apiDelete<PushUnsubscribeAck>("/push/subscriptions", {
    data: { endpoint },
  });
}
