/**
 * Centralized route paths.
 * Import from here rather than hardcoding strings throughout the app.
 */
export const PATHS = {
  // Public
  ADMIN_LOGIN: "/admin/login",
  APP_LOGIN: "/app/login",

  // Forced password change (server-issued temp password). Both shells
  // route here on first sign-in until the user posts a real password
  // via /v1/auth/change-password — every other endpoint is gated.
  ADMIN_CHANGE_PASSWORD: "/admin/change-password",
  APP_CHANGE_PASSWORD: "/app/change-password",

  // Public visitor flows
  PUBLIC_REGISTER: "/register",
  PUBLIC_CHECKOUT: "/checkout",
  PUBLIC_RIGHTS_REQUEST: "/rights/request",
  PUBLIC_RIGHTS_STATUS: "/rights/request",

  // Platform admin
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_TENANTS: "/admin/tenants",
  ADMIN_PLANS: "/admin/plans",
  ADMIN_SUBSCRIPTIONS: "/admin/subscriptions",
  ADMIN_DISCOUNTS: "/admin/discounts",
  ADMIN_LEGAL_DOCUMENTS: "/admin/legal-documents",
  ADMIN_DSR: "/admin/dsr",
  ADMIN_DSR_SLA_WATCH: "/admin/dsr/sla-watch",
  ADMIN_SETTINGS: "/admin/settings",

  // First-login tenant-info confirmation (super_admin only). A soft gate
  // the tenant shell routes super admins to until `onboardingInfoConfirmed`
  // flips true via POST /v1/onboarding/me/tenant-confirmation.
  APP_ONBOARDING_CONFIRM: "/app/onboarding/confirm",
  APP_ONBOARDING_COMPLETE: "/app/onboarding/complete",

  // Tenant
  APP_DASHBOARD: "/app/dashboard",
  // Visitors landing is the Pending tab — there is no useful index at
  // /app/visitors itself (it just redirects), so link here directly.
  APP_VISITORS: "/app/visitors/pending",
  APP_APPOINTMENTS: "/app/appointments",
  APP_DEPARTMENTS: "/app/departments",
  APP_BRANCHES: "/app/branches",
  APP_USERS: "/app/users",
  APP_BRANDING: "/app/branding",
  APP_INCIDENTS: "/app/incidents",
  APP_AUDIT: "/app/audit",
  APP_DPO: "/app/dpo",
  // Visitor-facing privacy notice shown at kiosk / QR check-in. Now derived
  // from the platform-managed Visitor Privacy Policy master — tenants can no
  // longer author it, so this page is read-only.
  APP_DPO_PRIVACY_NOTICES: "/app/dpo/privacy-notices",
  // Platform agreements (DPA + Visitor Privacy Policy) the tenant must accept.
  // Visible to every tenant role; only super_admin can accept/decline.
  APP_AGREEMENTS: "/app/agreements",
  APP_BILLING: "/app/billing",
  // Upgrade CTA target for tenants who are not yet on Premium — buying a
  // branch add-on requires Premium first, so "I need more branches /
  // visitor capacity" prompts route here to upgrade. Once already on
  // Premium, the dedicated BuyBranchAddonModal purchase flow is used
  // directly instead of this route.
  APP_BILLING_CHANGE_PLAN: "/app/billing/change-plan",
  APP_ALERTS: "/app/alerts",
  APP_SETTINGS: "/app/settings",
} as const;
