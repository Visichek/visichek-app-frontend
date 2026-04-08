import type { LawfulBasis, NoticeDisplayMode, DeletionAction, BranchStatus, LogoPosition } from "./enums";

export interface Tenant {
  id: string;
  companyName: string;
  lawfulBasis?: LawfulBasis;
  noticeDisplayMode?: NoticeDisplayMode;
  retentionDays?: number;
  defaultRetentionAction?: DeletionAction;
  dpoContactEmail?: string;
  privacyPolicyUrl?: string;
  countryOfHosting?: string;
  crossBorderApproved?: boolean;
  createdAt: number;
  updatedAt: number;
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
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  logoPosition?: LogoPosition;
  badgePrimaryColor?: string;
  badgeSecondaryColor?: string;
  badgeLogoUrl?: string;
  badgeLogoPosition?: LogoPosition;
}
