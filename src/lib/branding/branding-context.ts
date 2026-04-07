"use client";

import { createContext, useContext } from "react";
import type { TenantBranding } from "@/types/tenant";

interface BrandingContextValue {
  branding: TenantBranding | null;
  isLoaded: boolean;
}

export const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  isLoaded: false,
});

export function useBrandingContext(): BrandingContextValue {
  return useContext(BrandingContext);
}
