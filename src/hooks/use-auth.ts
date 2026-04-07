"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  setAdminSession,
  setSystemUserSession,
  clearSessionState,
} from "@/lib/store/session-slice";
import { clearBranding } from "@/lib/store/branding-slice";
import { setTokens, clearTokens } from "@/lib/auth/tokens";
import { apiPost } from "@/lib/api/request";
import { getPostLoginPath } from "@/lib/routing/redirects";
import type {
  LoginRequest,
  TokenPair,
  AdminProfile,
  SystemUserProfile,
} from "@/types/auth";
import type { SystemUserRole } from "@/types/enums";

interface AdminLoginResponse {
  tokens: TokenPair;
  profile: AdminProfile;
}

interface SystemUserLoginResponse {
  tokens: TokenPair;
  user: SystemUserProfile;
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  /**
   * Platform admin login.
   */
  const loginAdmin = useCallback(
    async (credentials: LoginRequest) => {
      const data = await apiPost<AdminLoginResponse>(
        "/admins/login",
        credentials
      );
      setTokens(data.tokens, "admin");
      dispatch(
        setAdminSession({ type: "admin", tokens: data.tokens, profile: data.profile })
      );
      router.push(getPostLoginPath("admin"));
    },
    [dispatch, router]
  );

  /**
   * Tenant staff login (receptionist, dept_admin, auditor, security_officer, dpo).
   */
  const loginSystemUser = useCallback(
    async (credentials: LoginRequest) => {
      const data = await apiPost<SystemUserLoginResponse>(
        "/system-users/login",
        credentials
      );
      setTokens(data.tokens, "system_user");
      dispatch(
        setSystemUserSession({
          type: "system_user",
          tokens: data.tokens,
          profile: data.user,
        })
      );
      router.push(getPostLoginPath("system_user", data.user.role));
    },
    [dispatch, router]
  );

  /**
   * Super admin global login (step 1 of dual-login flow).
   */
  const loginSuperAdminGlobal = useCallback(
    async (credentials: LoginRequest) => {
      const data = await apiPost<SystemUserLoginResponse>(
        "/system-users/super-admin/login",
        credentials
      );
      setTokens(data.tokens, "system_user");
      return data;
    },
    []
  );

  /**
   * Super admin tenant-scoped login (step 2 of dual-login flow).
   */
  const loginSuperAdminTenant = useCallback(
    async (tenantId: string) => {
      const data = await apiPost<SystemUserLoginResponse>(
        `/system-users/tenant/${tenantId}/login`
      );
      setTokens(data.tokens, "system_user");
      dispatch(
        setSystemUserSession({
          type: "system_user",
          tokens: data.tokens,
          profile: data.user,
        })
      );
      router.push(getPostLoginPath("system_user", "super_admin"));
    },
    [dispatch, router]
  );

  /**
   * Logout: clear all state and redirect to login.
   */
  const logout = useCallback(() => {
    clearTokens();
    dispatch(clearSessionState());
    dispatch(clearBranding());
    router.push("/app/login");
  }, [dispatch, router]);

  return {
    loginAdmin,
    loginSystemUser,
    loginSuperAdminGlobal,
    loginSuperAdminTenant,
    logout,
  };
}
