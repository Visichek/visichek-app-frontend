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
