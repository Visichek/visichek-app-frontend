import type {
  CheckinListParams,
  PendingApprovalsParams,
} from "@/types/checkin";

/**
 * Stable query-key factory for every check-in query.
 *
 * Using a factory rather than ad-hoc arrays keeps cache identity
 * consistent across the app and makes invalidation on mutation easy.
 */
export const checkinKeys = {
  all: ["checkins"] as const,

  // ── Public (kiosk) ─────────────────────────────────────────────
  publicConfig: (configId: string) =>
    ["checkins", "public", "config", configId] as const,
  publicConfigByTenant: (tenantId: string) =>
    ["checkins", "public", "config-by-tenant", tenantId] as const,
  publicEnums: (configId: string) =>
    ["checkins", "public", "enums", configId] as const,
  publicEnumsByTenant: (tenantId: string) =>
    ["checkins", "public", "enums-by-tenant", tenantId] as const,
  kycStatus: (checkinId: string) =>
    ["checkins", "public", "kyc-status", checkinId] as const,
  publicStatus: (checkinId: string) =>
    ["checkins", "public", "status", checkinId] as const,

  // ── Receptionist ───────────────────────────────────────────────
  list: (tenantId: string, params: CheckinListParams) =>
    ["checkins", "list", tenantId, params] as const,
  pending: (tenantId: string) =>
    ["checkins", "list", tenantId, { state: "pending_approval" }] as const,
  detail: (checkinId: string) =>
    ["checkins", "detail", checkinId] as const,
  pendingApprovals: (tenantId: string, params: PendingApprovalsParams) =>
    ["checkins", "pending-approvals", tenantId, params] as const,

  // ── Admin (configs) ────────────────────────────────────────────
  configsList: (tenantId: string) =>
    ["checkins", "configs", "list", tenantId] as const,
  configDetail: (configId: string) =>
    ["checkins", "configs", "detail", configId] as const,
};
