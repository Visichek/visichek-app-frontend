"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { setBranding, selectBranding, selectIsBrandingLoaded } from "@/lib/store/branding-slice";
import { selectTenantId } from "@/lib/store/session-slice";
import {
  applyBranding,
  applyDocumentBranding,
  clearBrandingStyles,
} from "@/lib/branding/apply-branding";
import { apiGet } from "@/lib/api/request";
import { normalizeBranding } from "@/features/branding/hooks/use-branding";
import type { TenantBranding } from "@/types/tenant";
import type { PublicTenantInfo } from "@/types/public";

/**
 * Fetch and apply tenant branding once after login.
 * Only used inside the tenant shell.
 *
 * We hit two endpoints in parallel:
 *  - `/branding/tenant/{id}`              — authenticated, full branding config (colors, logo, badge)
 *  - `/public/register/{id}/info`         — public, exposes companyName for titles/headers
 *
 * Either can fail independently and we still apply whatever we got.
 */
export function useTenantBranding() {
  const dispatch = useAppDispatch();
  const tenantId = useAppSelector(selectTenantId);
  const branding = useAppSelector(selectBranding);
  const isLoaded = useAppSelector(selectIsBrandingLoaded);
  const pathname = usePathname();

  useEffect(() => {
    if (!tenantId || isLoaded) return;
    const id = tenantId;

    let cancelled = false;

    async function fetchBranding() {
      const [brandingResult, infoResult] = await Promise.allSettled([
        apiGet<TenantBranding>(`/branding/tenant/${id}`),
        apiGet<PublicTenantInfo>(`/public/register/${id}/info`),
      ]);
      if (cancelled) return;

      const brandingData =
        brandingResult.status === "fulfilled" ? brandingResult.value : null;
      const infoData =
        infoResult.status === "fulfilled" ? infoResult.value : null;

      if (!brandingData && !infoData) return;

      const merged: TenantBranding = normalizeBranding({
        tenantId: id,
        ...(brandingData ?? {}),
        companyName: infoData?.companyName ?? brandingData?.companyName,
        logoUrl: brandingData?.logoUrl ?? infoData?.logoUrl,
        primaryColor: brandingData?.primaryColor ?? infoData?.primaryColor,
        secondaryColor: brandingData?.secondaryColor ?? infoData?.secondaryColor,
        accentColor: brandingData?.accentColor ?? infoData?.accentColor,
      });

      dispatch(setBranding(merged));
      applyBranding(merged);
    }

    fetchBranding();

    return () => {
      cancelled = true;
    };
  }, [tenantId, isLoaded, dispatch]);

  // Re-assert the tenant title + favicon after every client navigation.
  // Next.js re-injects its own `<link rel="icon">` metadata on each soft
  // route change, which would otherwise clobber the tenant favicon and snap
  // the tab back to the default VisiChek mark. `applyDocumentBranding` is
  // idempotent and removes any non-tenant icon links Next re-added, so the
  // tenant logo wins again. Keyed on `pathname` so it runs once per nav.
  useEffect(() => {
    if (branding) applyDocumentBranding(branding);
  }, [pathname, branding]);

  useEffect(() => {
    return () => {
      clearBrandingStyles();
    };
  }, []);

  return { branding, isLoaded };
}
