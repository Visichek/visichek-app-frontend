import type { Tenant, TenantBootstrapRequest } from './tenant';
import type { PlanTier, SubscriptionStatus, BillingCycle, AccountStatus } from './enums';

/**
 * Lightweight admin summary returned by GET /admins/search.
 * Has only the fields needed to identify an admin — no tokens or permissions.
 */
export interface AdminSearchResult {
  id: string;
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  mfaEnabled: boolean;
  dateCreated?: number;
  lastUpdated?: number;
}

/**
 * Re-exported from `@/types/dashboard` so existing callers
 * (`@/types/admin#AdminDashboardStats`) keep working. The full shape now
 * mirrors the GET /v1/admins/dashboard/stats response — see the
 * definition in `dashboard.ts` for field-level docs.
 */
export type { AdminDashboardStats } from "./dashboard";

/**
 * Admin Billing Summary
 */
export interface AdminBillingSummary {
  totalMrr: number; // Total Monthly Recurring Revenue in minor units
  totalArr: number; // Total Annual Recurring Revenue in minor units
  currency?: string;
  activeSubscriptions: number;
  pendingInvoices: number;
  overdueInvoices: number;
  period?: string;
}

/**
 * Plan summary embedded in admin tenant list responses.
 */
export interface TenantPlanSummary {
  planId: string;
  planName: string;
  planDisplayName: string;
  planTier: PlanTier;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  billingCycle: BillingCycle;
  effectivePrice: number;
  currency: string;
  currentPeriodEnd: number | null;
  trialEndsAt: number | null;
  entityCaps: {
    maxSystemUsers?: number;
    maxDepartments?: number;
    maxBranches?: number;
    maxVisitorsPerMonth?: number;
    maxAppointmentsPerMonth?: number;
  };
}

/**
 * Tenant Info for Admin
 */
export interface AdminTenant extends Tenant {
  planSummary?: TenantPlanSummary | null;
  systemUsersCount?: number;
  lastActivity?: number;
  /**
   * Organization point of contact (WS4): the main super admin summary
   * `{userId, fullName, email, role}`, when the admin payload embeds it.
   * Optional — older payloads carry nothing and the POC card hides.
   */
  contactSummary?: import("./tenant").OrgContactSummary | null;
}
