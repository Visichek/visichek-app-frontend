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
 * Inner `config` block of `WidgetConfig`. Fields beyond `widget_id`,
 * `pages`, and `review_process` are forwarded verbatim to Dojah without
 * frontend interpretation.
 */
export interface KycWidgetInnerConfig {
  widget_id: string;
  pages: KycWidgetPage[];
  review_process?: "automatic" | "manual";
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
 * Full payload the backend emits on `POST /v1/kyc/initiate`. Forwarded
 * verbatim to the Dojah widget — the frontend does not synthesise any
 * fields itself, and never reads Dojah credentials from environment
 * variables.
 *
 * Wire field names use snake_case here because they are passed through to
 * the third-party widget unchanged; the rest of the app's response types
 * are camelCase.
 */
export interface KycWidgetConfig {
  app_id: string;
  public_key: string;
  type: string;
  config: KycWidgetInnerConfig;
  metadata: KycWidgetMetadata;
  base_url: string;
}

export interface KycInitiateRequest {
  checkinId: string;
}

export interface KycInitiateResponse {
  referenceId: string;
  provider: "dojah";
  widgetConfig: KycWidgetConfig;
}

export interface KycSkipRequest {
  checkinId: string;
  reason?: string;
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
