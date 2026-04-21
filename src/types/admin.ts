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
 * Admin Dashboard Stats
 */
export interface AdminDashboardStats {
  totalTenants: number;
  activeSubscriptions: number;
  mrr: number; // Monthly Recurring Revenue in minor units
  currency?: string;
  period?: string;
  trends?: {
    tenantGrowth?: number;
    subscriptionGrowth?: number;
    mrrGrowth?: number;
  };
}

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
}
