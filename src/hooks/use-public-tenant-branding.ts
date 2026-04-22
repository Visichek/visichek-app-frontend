"use client";

import { useEffect } from "react";
import { usePublicTenantInfo } from "@/features/public-registration/hooks/use-public-registration";
import {
  applyDocumentBranding,
  clearDocumentBranding,
} from "@/lib/branding/apply-branding";
import type { TenantBranding } from "@/types/tenant";

/**
 * Apply tenant favicon + document title on public pages where the tenant ID
 * is known from the URL (kiosks, tenant-scoped landing pages). Colors are
 * left alone — Redux-backed branding is only wired inside the auth shell,
 * and public pages should not fight the default platform theme.
 *
 * Safe to call with a falsy tenantId — it becomes a no-op.
 */
export function usePublicTenantBranding(tenantId: string | undefined | null) {
  const { data } = usePublicTenantInfo(tenantId ?? "");

  useEffect(() => {
    if (!data) return;

    const branding: TenantBranding = {
      tenantId: data.tenantId,
      companyName: data.companyName,
      logoUrl: data.logoUrl,
    };

    applyDocumentBranding(branding);

    return () => {
      clearDocumentBranding();
    };
  }, [data]);
}
