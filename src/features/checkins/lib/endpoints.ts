/**
 * All endpoints used by the check-in flow, in one place.
 *
 * Keeping them here makes the wire contract easy to audit and gives the
 * rest of the module a single source of truth.
 */

// ── Public (kiosk) ───────────────────────────────────────────────────

/** Public config: logo, required fields, toggles. */
export const checkinConfigPath = (configId: string) =>
  `/checkin-configs/${configId}`;

/**
 * Resolve the active kiosk config for a tenant.
 *
 * The kiosk page is keyed by tenantId (existing /register/[tenantId] URL)
 * but the submit endpoints are keyed by checkin_config_id. This lookup
 * bridges the two.
 *
 * Backend contract: returns the active `PublicCheckinConfigOut` for the
 * tenant, or 404 if none is active.
 */
export const checkinConfigByTenantPath = (tenantId: string) =>
  `/public/tenants/${tenantId}/active-checkin-config`;

/** Returning-visitor lookup by email and/or phone. */
export const checkinVisitorLookupPath = (configId: string) =>
  `/checkin-configs/${configId}/visitors/lookup`;

/** Combined multipart submit — preferred path. */
export const checkinSubmitMultipartPath = (configId: string) =>
  `/checkin-configs/${configId}/submit`;

/**
 * Tenant-configurable picker bundle (purpose_of_visit, id_type,
 * visitor_category). Active options only — already filtered server-side.
 */
export const checkinConfigEnumsPath = (configId: string) =>
  `/checkin-configs/${configId}/enums`;

/** Same enum bundle, but keyed by tenant_id for kiosks routed by tenant. */
export const checkinConfigEnumsByTenantPath = (tenantId: string) =>
  `/checkin-configs/by-tenant/${tenantId}/enums`;

// ── KYC (post-submit) ────────────────────────────────────────────────

/**
 * Start a KYC verification for a check-in in `pending_kyc` state. Returns
 * a `widgetConfig` payload the kiosk hands to the Dojah React widget; the
 * webhook (not the frontend) reports the verification result back.
 */
export const kycInitiatePath = () => `/kyc/initiate`;

/**
 * Skip the KYC step for a check-in. Returns 403 when the tenant has
 * `kycRequired: true` — the kiosk should hide the skip CTA in that case.
 */
export const kycSkipPath = () => `/kyc/skip`;

/**
 * Polling fallback for when the Dojah widget closes inconclusively. The
 * kiosk should poll every 3–5s for at most 60s, then surface a retry CTA
 * if the status still isn't terminal.
 */
export const kycStatusPath = (checkinId: string) =>
  `/kyc/status/${checkinId}`;

/**
 * Default-mode submit: used when the tenant has not customized a config yet
 * and the public endpoint returns defaults with `checkin_config_id === ""`.
 * The backend resolves the tenant's default config server-side.
 */
export const checkinSubmitDefaultByTenantPath = (tenantId: string) =>
  `/public/tenants/${tenantId}/submit`;

/**
 * Non-PII recognition probe. Returns `{ found, visitorId, totalVisits,
 * lastVisitAgoDays, idVerifiedRecently }` so the kiosk can switch into the
 * compact "welcome back" flow without fetching any stored bio data.
 */
export const checkinVisitorStatusPath = (tenantId: string) =>
  `/public/tenants/${tenantId}/visitor-status`;

/**
 * Minimal submit for a recognised visitor. Payload is `{ visitorId,
 * purpose, tenantSpecificData }` — no email, phone, or bio_data. The
 * backend reuses the stored visitor record for identity.
 */
export const checkinSubmitByVisitorIdPath = (tenantId: string) =>
  `/public/tenants/${tenantId}/submit-by-visitor-id`;

/** Legacy JSON submit — kept for backend parity; not used by the kiosk UI. */
export const checkinSubmitJsonPath = (configId: string) =>
  `/checkin-configs/${configId}/checkins`;

// ── Receptionist / tenant-authenticated ──────────────────────────────

/** List check-ins scoped to a tenant. */
export const checkinListPath = (tenantId: string) =>
  `/tenants/${tenantId}/checkins`;

/** Single check-in detail. */
export const checkinDetailPath = (checkinId: string) =>
  `/checkins/${checkinId}`;

/** Approve or reject a pending check-in. */
export const checkinConfirmPath = (checkinId: string) =>
  `/checkins/${checkinId}/confirm`;

/**
 * Unified approval queue — pending kiosk check-ins AND scheduled
 * appointments whose host pre-vetted them, in one paginated list.
 * Each row carries a `sourceType` discriminator so the frontend knows
 * which endpoint to call to action it.
 */
export const pendingApprovalsPath = (tenantId: string) =>
  `/tenants/${tenantId}/pending-approvals`;

// ── Admin (config management) ────────────────────────────────────────

/** List configs for a tenant. */
export const checkinConfigsAdminListPath = (tenantId: string) =>
  `/tenants/${tenantId}/checkin-configs`;

/** Create a new config for a tenant. */
export const checkinConfigsAdminCreatePath = (tenantId: string) =>
  `/tenants/${tenantId}/checkin-configs`;

/** Get, update, or delete a specific config. */
export const checkinConfigAdminPath = (configId: string) =>
  `/checkin-configs/${configId}`;
