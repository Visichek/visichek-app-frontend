import type { LawfulBasis, NoticeDisplayMode, DeletionAction, BranchStatus, LogoPosition } from "./enums";

export interface Tenant {
  id: string;
  company_name: string;
  lawful_basis?: LawfulBasis;
  notice_display_mode?: NoticeDisplayMode;
  retention_days?: number;
  default_retention_action?: DeletionAction;
  dpo_contact_email?: string;
  privacy_policy_url?: string;
  country_of_hosting?: string;
  cross_border_approved?: boolean;
  created_at: number;
  updated_at: number;
}

export interface TenantBootstrapRequest {
  company_name: string;
  lawful_basis?: LawfulBasis;
  notice_display_mode?: NoticeDisplayMode;
  retention_days?: number;
  default_retention_action?: DeletionAction;
  dpo_contact_email?: string;
  privacy_policy_url?: string;
  country_of_hosting?: string;
  cross_border_approved?: boolean;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  status?: BranchStatus;
  is_active?: boolean;
  created_at: number;
  updated_at: number;
}

export interface Department {
  id: string;
  tenant_id: string;
  name: string;
  branch_id?: string;
  created_at: number;
  updated_at: number;
}

export interface TenantBranding {
  tenant_id: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  logo_position?: LogoPosition;
  badge_primary_color?: string;
  badge_secondary_color?: string;
  badge_logo_url?: string;
  badge_logo_position?: LogoPosition;
}
