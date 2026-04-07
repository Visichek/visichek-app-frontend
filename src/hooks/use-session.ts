"use client";

import { useAppSelector } from "@/lib/store/hooks";
import {
  selectIsAuthenticated,
  selectSessionType,
  selectAdminProfile,
  selectSystemUserProfile,
  selectCurrentRole,
  selectTenantId,
} from "@/lib/store/session-slice";

export function useSession() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const sessionType = useAppSelector(selectSessionType);
  const adminProfile = useAppSelector(selectAdminProfile);
  const systemUserProfile = useAppSelector(selectSystemUserProfile);
  const currentRole = useAppSelector(selectCurrentRole);
  const tenantId = useAppSelector(selectTenantId);

  return {
    isAuthenticated,
    sessionType,
    adminProfile,
    systemUserProfile,
    currentRole,
    tenantId,
    isAdmin: sessionType === "admin",
    isSystemUser: sessionType === "system_user",
  };
}
