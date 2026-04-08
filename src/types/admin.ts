import type { Tenant, TenantBootstrapRequest } from './tenant';

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
 * Tenant Info for Admin
 */
export interface AdminTenant extends Tenant {
  contactEmail?: string;
  planName?: string;
  subscriptionStatus?: string;
  planTier?: string;
  systemUsersCount?: number;
  lastActivity?: number;
}
