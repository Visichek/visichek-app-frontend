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
  AdminLoginResponse,
  SystemUserLoginResponse,
  SuperAdminGlobalLoginResponse,
} from "@/types/auth";

/**
 * Extract a TokenPair from a flat login response where
 * accessToken and refreshToken are top-level fields.
 */
function extractTokens(response: SystemUserLoginResponse) {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
  };
}

/**
 * Extract a SystemUserProfile from a flat login response,
 * omitting token fields.
 */
function extractProfile(response: SystemUserLoginResponse) {
  return {
    id: response.id,
    fullName: response.fullName,
    email: response.email,
    role: response.role,
    tenantId: response.tenantId,
    departmentId: response.departmentId,
  };
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  /**
   * Platform admin login.
   * POST /v1/admins/login
   */
  const loginAdmin = useCallback(
    async (credentials: LoginRequest) => {
      const data = await apiPost<AdminLoginResponse>(
        "/admins/login",
        credentials
      );

      const tokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      const profile = {
        id: data.Id,
        fullName: data.fullName,
        email: data.email,
      };

      setTokens(tokens, "admin");
      dispatch(setAdminSession({ type: "admin", tokens, profile }));
      router.push(getPostLoginPath("admin"));
    },
    [dispatch, router]
  );

  /**
   * Tenant staff login (receptionist, dept_admin, auditor, security_officer, dpo).
   * POST /v1/system-users/tenant/{tenantId}/login
   *
   * Requires a tenantId to scope the login to the correct tenant.
   */
  const loginSystemUser = useCallback(
    async (credentials: LoginRequest, tenantId: string) => {
      const data = await apiPost<SystemUserLoginResponse>(
        `/system-users/tenant/${tenantId}/login`,
        credentials
      );

      const tokens = extractTokens(data);
      const profile = extractProfile(data);

      setTokens(tokens, "system_user");
      dispatch(
        setSystemUserSession({ type: "system_user", tokens, profile })
      );
      router.push(getPostLoginPath("system_user", data.role));
    },
    [dispatch, router]
  );

  /**
   * Super admin global login (step 1 of dual-login flow).
   * POST /v1/system-users/super-admin/login
   *
   * Returns user profile, tenant context, and tenant-scoped login URL.
   * Does NOT complete login — caller must follow up with loginSuperAdminTenant.
   */
  const loginSuperAdminGlobal = useCallback(
    async (credentials: LoginRequest) => {
      const data = await apiPost<SuperAdminGlobalLoginResponse>(
        "/system-users/super-admin/login",
        credentials
      );

      // Store tokens from step 1 so the tenant-scoped call is authenticated
      const tokens = extractTokens(data.user);
      setTokens(tokens, "system_user");

      return data;
    },
    []
  );

  /**
   * Super admin tenant-scoped login (step 2 of dual-login flow).
   * POST /v1/system-users/tenant/{tenantId}/login
   *
   * Uses the tokens from step 1 (already stored in memory) to
   * authenticate. The interceptor adds the auth header automatically.
   * Replaces step-1 tokens with tenant-scoped tokens.
   */
  const loginSuperAdminTenant = useCallback(
    async (tenantId: string) => {
      const data = await apiPost<SystemUserLoginResponse>(
        `/system-users/tenant/${tenantId}/login`,
        {}
      );

      const tokens = extractTokens(data);
      const profile = extractProfile(data);

      setTokens(tokens, "system_user");
      dispatch(
        setSystemUserSession({ type: "system_user", tokens, profile })
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
