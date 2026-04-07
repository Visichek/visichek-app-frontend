"use client";

import { useCallback, useMemo } from "react";
import { useSession } from "./use-session";
import { ROLE_CAPABILITIES } from "@/lib/permissions/roles";
import { canAccessRoute } from "@/lib/permissions/route-access";
import type { Capability } from "@/lib/permissions/capabilities";

export function useCapabilities() {
  const { currentRole } = useSession();

  const capabilities = useMemo(() => {
    if (!currentRole) return [];
    return ROLE_CAPABILITIES[currentRole] ?? [];
  }, [currentRole]);

  const hasCapability = useCallback(
    (capability: Capability) => capabilities.includes(capability),
    [capabilities]
  );

  const canAccess = useCallback(
    (pathname: string) => {
      if (!currentRole) return false;
      return canAccessRoute(currentRole, pathname);
    },
    [currentRole]
  );

  return { capabilities, hasCapability, canAccess };
}
