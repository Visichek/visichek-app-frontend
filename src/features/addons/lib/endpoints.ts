/**
 * Wire paths for the add-on framework (section J of changes.txt).
 *
 *   - Public catalog (active SKUs only):   /v1/addons
 *   - Admin catalog management:            /v1/admins/addons
 *   - Tenant purchases + history:          /v1/tenants/me/addons
 *   - Webhook activation (ops):            /v1/admins/addons/webhooks/activate
 */

// Public catalog reads (no auth required for unauthenticated pricing
// pages, but the auth interceptor still attaches cookies when present).
export const addonsCatalogPath = () => `/addons`;
export const addonCatalogDetailPath = (addonId: string) =>
  `/addons/${addonId}`;

// Application-admin catalog management.
export const adminAddonsListPath = () => `/admins/addons`;
export const adminAddonsCreatePath = () => `/admins/addons`;
export const adminAddonDetailPath = (addonId: string) =>
  `/admins/addons/${addonId}`;
export const adminAddonWebhookActivatePath = (paymentReference: string) =>
  `/admins/addons/webhooks/activate/${paymentReference}`;

// Tenant-side purchase + history.
export const tenantAddonsPath = () => `/tenants/me/addons`;
export const tenantAddonsActivePath = () => `/tenants/me/addons/active`;
export const tenantAddonDetailPath = (tenantAddonId: string) =>
  `/tenants/me/addons/${tenantAddonId}`;
export const tenantAddonPurchasePath = () => `/tenants/me/addons/purchase`;
export const tenantAddonCancelPath = (tenantAddonId: string) =>
  `/tenants/me/addons/${tenantAddonId}/cancel`;
