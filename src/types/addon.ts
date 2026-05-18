/**
 * Wire types for the add-on framework (section J of changes.txt).
 *
 * Tenants can buy extra resource on top of their plan without changing
 * tier. The first concrete add-on is `storage_extension` (1 GB for
 * ₦2,000, default 12-month validity); the same shapes cover future
 * kinds (`visitor_quota`, `branch_quota`, …) — the consuming service
 * reads its own key out of `benefitPerUnit` / `benefitSnapshot`.
 */

// ── Enums ────────────────────────────────────────────────────────────

/** Add-on SKU kinds. Server-side enum — new kinds require a backend release. */
export type AddonKind =
  | "storage_extension"
  | "visitor_quota"
  | "branch_quota";

/** Catalog status. Only `active` SKUs are surfaced to tenants. */
export type AddonStatus = "draft" | "active" | "archived";

/** Lifecycle of a tenant's purchased addon row. */
export type TenantAddonStatus =
  | "pending"
  | "active"
  | "expired"
  | "cancelled";

export type AddonPaymentProvider = "stripe" | "flutterwave" | "app";

// ── Catalog ──────────────────────────────────────────────────────────

/**
 * SKU from `GET /v1/addons` (public, active only) or
 * `GET /v1/admins/addons` (admin, all statuses).
 *
 * `benefitPerUnit` is kind-specific: for `storage_extension` it is
 * `{ storageMb: <number> }`; for `visitor_quota` it would be
 * `{ visitors: <number> }`; etc. The frontend treats it as a free-form
 * record and reads the key that matches the kind.
 */
export interface AddonOut {
  id: string;
  name: string;
  description?: string | null;
  kind: AddonKind;
  status: AddonStatus;
  unitPrice: number;
  currency: string;
  benefitPerUnit: Record<string, number | string>;
  /** null = perpetual (never expires). */
  validityDays?: number | null;
  maxUnitsPerPurchase: number;
  createdAt?: number;
  updatedAt?: number;
}

/** Body for `POST /v1/admins/addons`. */
export interface AddonCreateRequest {
  name: string;
  description?: string;
  kind: AddonKind;
  status?: AddonStatus;
  unitPrice: number;
  currency: string;
  benefitPerUnit: Record<string, number | string>;
  validityDays?: number | null;
  maxUnitsPerPurchase?: number;
}

/** Body for `PATCH /v1/admins/addons/{addon_id}`. All fields optional. */
export type AddonUpdateRequest = Partial<AddonCreateRequest>;

export interface AddonListParams {
  kind?: AddonKind;
}

// ── Tenant purchases ─────────────────────────────────────────────────

/**
 * Tenant-side row from `/v1/tenants/me/addons*`. Snapshotted price +
 * benefit mean catalog edits never retro-change a previously-paid row.
 */
export interface TenantAddonOut {
  id: string;
  tenantId: string;
  addonId: string;
  addonName: string;
  addonKind: AddonKind;
  quantity: number;
  unitPriceSnapshot: number;
  currencySnapshot: string;
  benefitSnapshot: Record<string, number | string>;
  status: TenantAddonStatus;
  purchasedAt: number;
  /** null = perpetual. */
  expiresAt?: number | null;
  paymentProvider?: AddonPaymentProvider | null;
  paymentReference?: string | null;
  checkoutUrl?: string | null;
  completedAt?: number | null;
  cancelledAt?: number | null;
  cancellationReason?: string | null;
  createdByUserId?: string | null;
}

/** Body for `POST /v1/tenants/me/addons/purchase`. */
export interface AddonPurchaseRequest {
  addonId: string;
  quantity: number;
  /** Server falls back to its preferred provider when omitted. */
  preferredProvider?: AddonPaymentProvider;
}

/** Response from `POST /v1/tenants/me/addons/purchase`. */
export interface AddonPurchaseResponse {
  tenantAddonId: string;
  addonId: string;
  addonName: string;
  addonKind: AddonKind;
  quantity: number;
  amountTotal: number;
  currency: string;
  paymentProvider: AddonPaymentProvider;
  /**
   * Hosted checkout URL — open this in the browser. On success the
   * provider webhook flips the tenant_addons row to `active`; on
   * failure the row is `cancelled`.
   */
  checkoutUrl: string;
  paymentReference: string;
  status: TenantAddonStatus;
}

/** Body for `POST /v1/tenants/me/addons/{tenant_addon_id}/cancel`. */
export interface AddonCancelRequest {
  reason?: string;
}
