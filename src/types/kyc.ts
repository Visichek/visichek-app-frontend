/**
 * Types for the KYC verification flow.
 *
 * KYC runs after a check-in is submitted. When the tenant's plan grants
 * KYC, the submit response carries `state: "pending_verification"` and the kiosk:
 *   1. calls `POST /v1/kyc/initiate` with the new `checkinId` to fetch a
 *      `widgetConfig` payload, then hands that payload directly to the
 *      Dojah React widget;
 *   2. or calls `POST /v1/kyc/skip` if the visitor opts out and the
 *      tenant has `kycRequired: false`;
 *   3. polls `GET /v1/kyc/status/{checkinId}` if the widget closes
 *      inconclusively, until status settles to `success`/`failed`/`expired`.
 *
 * The actual verification result lands on the backend via Dojah's webhook,
 * which carries `metadata.checkinId`. The frontend never forwards Dojah's
 * `referenceId` itself — backend correlates via the metadata embedded in
 * `widgetConfig`.
 */

/**
 * One page in the Dojah widget flow. Each entry corresponds to a
 * verification step (e.g. `government-data`, `selfie`); the inner
 * `config` payload is opaque to the frontend and forwarded as-is.
 */
export interface KycWidgetPage {
  page: string;
  config: Record<string, unknown>;
}

/**
 * Inner `config` block of `WidgetConfig`. Backend returns camelCase
 * (`widgetId`, `reviewProcess`); the kyc-widget wrapper transforms
 * `widgetId` → `widget_id` for the Dojah SDK, which expects snake_case.
 */
export interface KycWidgetInnerConfig {
  widgetId: string;
  pages: KycWidgetPage[];
  reviewProcess?: "automatic" | "manual";
  [key: string]: unknown;
}

/**
 * Round-trip metadata Dojah echoes on the webhook back to the backend.
 * The kiosk only reads `checkinId` for display; everything else is
 * forwarded as-is.
 */
export interface KycWidgetMetadata {
  tenantId: string;
  checkinId: string;
  visitorId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Full payload the backend emits on `POST /v1/kyc/initiate`. The API
 * client converts the wire response to camelCase, matching the rest of
 * the app's response types.
 *
 * Note: `appId`, `publicKey`, and `widgetId` are currently overridden by
 * hardcoded constants in `KycWidget` because the backend doesn't reliably
 * populate them. Only `metadata` (per-checkin correlation) is used as-is.
 */
export interface KycWidgetConfig {
  appId: string;
  publicKey: string;
  type: string;
  config: KycWidgetInnerConfig;
  metadata: KycWidgetMetadata;
  baseUrl: string;
}

export interface KycInitiateRequest {
  checkinId: string;
  /**
   * Capability token from the check-in creation response
   * (`CheckinOut.capabilityToken`). Required — the backend rejects the call
   * with 403 AUTH_PERMISSION_DENIED (audited `kyc.capability_rejected`) when
   * it's missing, expired, or bound to a different check-in/tenant.
   */
  capabilityToken: string;
}

export interface KycInitiateResponse {
  referenceId: string;
  provider: "dojah";
  widgetConfig: KycWidgetConfig;
}

export interface KycSkipRequest {
  checkinId: string;
  reason?: string;
  /**
   * Capability token from the check-in creation response
   * (`CheckinOut.capabilityToken`). Required — same 403 rejection as
   * `KycInitiateRequest.capabilityToken` when missing/invalid/mismatched.
   */
  capabilityToken: string;
}

export interface KycSkipResponse {
  checkinId: string;
  referenceId: string | null;
  status: "skipped";
}

/**
 * Status values returned by `GET /v1/kyc/status/{checkin_id}`.
 *   - `ongoing`: visitor has opened the widget but it has not finished.
 *   - `success`: webhook confirmed the verification; the check-in has
 *     advanced to `pending_approval`.
 *   - `failed`: webhook reported failure; the check-in has been moved
 *     directly to `rejected`. The kiosk should offer a retry CTA.
 *   - `skipped`: the visitor opted out via `POST /v1/kyc/skip`.
 *   - `expired`: the verification reference timed out without a final
 *     webhook. Treat the same as `failed` for retry purposes.
 */
export type KycStatus = "ongoing" | "success" | "failed" | "skipped" | "expired";

export interface KycStatusResponse {
  checkinId: string;
  referenceId: string | null;
  status: KycStatus;
  failureReason: string | null;
}
