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
  crossBorderApproved?: boolean;
  isActive?: boolean;
  activeNoticeVersion?: string | null;
  enableRepeatVisitorRecognition?: boolean;
  mfaDefaultForUsers?: boolean;
  mfaUserOverrideAllowed?: boolean;
  stripeCustomerId?: string | null;
  flutterwaveCustomerId?: string | null;
  defaultPaymentProvider?: string | null;
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
  createdAt: number;
  updatedAt: number;
}

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  branchId?: string;
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
