"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { setBranding, selectBranding, selectIsBrandingLoaded } from "@/lib/store/branding-slice";
import { selectTenantId } from "@/lib/store/session-slice";
import { applyBranding, clearBrandingStyles } from "@/lib/branding/apply-branding";
import { apiGet } from "@/lib/api/request";
import type { TenantBranding } from "@/types/tenant";

/**
 * Fetch and apply tenant branding once after login.
 * Only used inside the tenant shell.
 */
export function useTenantBranding() {
  const dispatch = useAppDispatch();
  const tenantId = useAppSelector(selectTenantId);
  const branding = useAppSelector(selectBranding);
  const isLoaded = useAppSelector(selectIsBrandingLoaded);

  useEffect(() => {
    if (!tenantId || isLoaded) return;

    let cancelled = false;

    async function fetchBranding() {
      try {
        const data = await apiGet<TenantBranding>(
          `/branding/tenant/${tenantId}`
        );
        if (!cancelled) {
          dispatch(setBranding(data));
          applyBranding(data);
        }
      } catch {
        // Branding is optional; if it fails, continue with defaults
      }
    }

    fetchBranding();

    return () => {
      cancelled = true;
    };
  }, [tenantId, isLoaded, dispatch]);

  useEffect(() => {
    return () => {
      clearBrandingStyles();
    };
  }, []);

  return { branding, isLoaded };
}
