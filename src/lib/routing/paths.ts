/**
 * Centralized route paths.
 * Import from here rather than hardcoding strings throughout the app.
 */
export const PATHS = {
  // Public
  ADMIN_LOGIN: "/admin/login",
  APP_LOGIN: "/app/login",

  // Platform admin
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_TENANTS: "/admin/tenants",
  ADMIN_PLANS: "/admin/plans",
  ADMIN_SUBSCRIPTIONS: "/admin/subscriptions",
  ADMIN_DISCOUNTS: "/admin/discounts",
  ADMIN_PAYMENTS: "/admin/payments",

  // Tenant
  APP_DASHBOARD: "/app/dashboard",
  APP_VISITORS: "/app/visitors",
  APP_APPOINTMENTS: "/app/appointments",
  APP_DEPARTMENTS: "/app/departments",
  APP_BRANCHES: "/app/branches",
  APP_USERS: "/app/users",
  APP_BRANDING: "/app/branding",
  APP_INCIDENTS: "/app/incidents",
  APP_AUDIT: "/app/audit",
  APP_DPO: "/app/dpo",
  APP_BILLING: "/app/billing",
} as const;
