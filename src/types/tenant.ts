import type { LawfulBasis, NoticeDisplayMode, DeletionAction, BranchStatus, LogoPosition } from "./enums";

export interface Tenant {
  id: string;
  companyName: string;
  lawfulBasis?: LawfulBasis;
  noticeDisplayMode?: NoticeDisplayMode;
  retentionDays?: number;
  defaultRetentionAction?: DeletionAction;
  dpoContactEmail?: string | null;
  privacyPolicyUrl?: string | null;
  countryOfHosting?: string;
  /** Organization's registered address — fills the Organization party "Address" line in the per-tenant DPA. Max 500 chars; may be absent on older tenants. */
  organizationAddress?: string | null;
  crossBorderApproved?: boolean;
  isActive?: boolean;
  activeNoticeVersion?: string | null;
  enableRepeatVisitorRecognition?: boolean;
  mfaDefaultForUsers?: boolean;
  mfaUserOverrideAllowed?: boolean;
  stripeCustomerId?: string | null;
  flutterwaveCustomerId?: string | null;
  defaultPaymentProvider?: string | null;
  /** True once the tenant has confirmed their onboarding info. May be absent on tenants created before the flag existed — treat missing as not confirmed. */
  onboardingInfoConfirmed?: boolean;
  onboardingInfoConfirmedAt?: number | null;
  /** True once the tenant accepted the Data Processing Agreement. May be absent on older tenants — treat missing as not accepted. */
  dpaAccepted?: boolean;
  dpaAcceptedAt?: number | null;
  dpaAcceptedBy?: string | null;
  dpaVersion?: string | null;
  dateCreated: number;
  lastUpdated: number;
}

export interface TenantBootstrapRequest {
  companyName: string;
  lawfulBasis?: LawfulBasis;
  noticeDisplayMode?: NoticeDisplayMode;
  retentionDays?: number;
  defaultRetentionAction?: DeletionAction;
  dpoContactEmail?: string;
  privacyPolicyUrl?: string;
  countryOfHosting?: string;
  crossBorderApproved?: boolean;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  status?: BranchStatus;
  isActive?: boolean;
  /** True for the tenant's auto-created HQ branch. */
  isHeadquarters?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  branchId?: string;
  /**
   * Optional embedded branch label populated by Phase 4 list responses.
   * May be null for branch-scoped roles where the redundant label is
   * suppressed by the backend. Field is OPTIONAL — handle as missing.
   */
  branchSummary?: { id: string; name: string; isActive?: boolean } | null;
  createdAt: number;
  updatedAt: number;
}

export interface TenantBranding {
  tenantId: string;
  /** Tenant's display name — sourced from PublicTenantInfo and used in titles/headers */
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  logoObjectKey?: string;
  logoPosition?: LogoPosition;
  badgePrimaryColor?: string;
  badgeSecondaryColor?: string;
  badgeLogoUrl?: string;
  badgeLogoPosition?: LogoPosition;
}
