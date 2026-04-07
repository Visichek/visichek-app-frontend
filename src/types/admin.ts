import type { Tenant, TenantBootstrapRequest } from './tenant';

/**
 * Admin Dashboard Stats
 */
export interface AdminDashboardStats {
  total_tenants: number;
  active_subscriptions: number;
  mrr: number; // Monthly Recurring Revenue in minor units
  currency?: string;
  period?: string;
  trends?: {
    tenant_growth?: number;
    subscription_growth?: number;
    mrr_growth?: number;
  };
}

/**
 * Admin Billing Summary
 */
export interface AdminBillingSummary {
  total_mrr: number; // Total Monthly Recurring Revenue in minor units
  total_arr: number; // Total Annual Recurring Revenue in minor units
  currency?: string;
  active_subscriptions: number;
  pending_invoices: number;
  overdue_invoices: number;
  period?: string;
}

/**
 * Tenant Info for Admin
 */
export interface AdminTenant extends Tenant {
  contact_email?: string;
  plan_name?: string;
  subscription_status?: string;
  plan_tier?: string;
  system_users_count?: number;
  last_activity?: number;
}
