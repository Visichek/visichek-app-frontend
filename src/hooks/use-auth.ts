"use client";

import { useCallback } from "react";
import { useAppDispatch } from "@/lib/store/hooks";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  setAdminSession,
  setSystemUserSession,
  clearSessionState,
} from "@/lib/store/session-slice";
import { clearBranding } from "@/lib/store/branding-slice";
import { setTokens, clearTokens, getSessionType } from "@/lib/auth/tokens";
import { apiPost } from "@/lib/api/request";
import apiClient from "@/lib/api/client";
import { getPostLoginPath } from "@/lib/routing/redirects";
import { isOtpChallenge, type OtpChallengeResponse, type OtpVerifyRequest } from "@/types/account";
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

/**
 * Result from a login attempt. Either redirects to dashboard,
 * or returns an OTP challenge if 2FA is required.
 */
export type LoginResult =
  | { otpRequired: false }
  | { otpRequired: true; otpChallengeId: string; sessionType: "admin" | "system_user" };

export function useAuth() {
  const dispatch = useAppDispatch();
  const { navigate } = useNavigationLoading();

  /**
   * Platform admin login.
   * POST /v1/admins/login
   *
   * Returns OTP challenge if 2FA is required (always for admins).
   */
  const loginAdmin = useCallback(
    async (credentials: LoginRequest): Promise<LoginResult> => {
      const data = await apiPost<AdminLoginResponse | OtpChallengeResponse>(
        "/admins/login",
        credentials
      );

      // Check if OTP challenge returned
      if (isOtpChallenge(data)) {
        return {
          otpRequired: true,
          otpChallengeId: data.otpChallengeId,
          sessionType: "admin",
        };
      }

      const loginData = data as AdminLoginResponse;
      const tokens = {
        accessToken: loginData.accessToken,
        refreshToken: loginData.refreshToken,
      };
      const profile = {
        id: loginData.Id,
        fullName: loginData.fullName,
        email: loginData.email,
      };

      setTokens(tokens, "admin");
      dispatch(setAdminSession({ type: "admin", tokens, profile }));
      navigate(getPostLoginPath("admin"));
      return { otpRequired: false };
    },
    [dispatch, navigate]
  );

  /**
   * Tenant staff login (receptionist, dept_admin, auditor, security_officer, dpo).
   * POST /v1/system-users/tenant/{tenantId}/login
   */
  const loginSystemUser = useCallback(
    async (credentials: LoginRequest, tenantId: string): Promise<LoginResult> => {
      const data = await apiPost<SystemUserLoginResponse | OtpChallengeResponse>(
        `/system-users/tenant/${tenantId}/login`,
        credentials
      );

      if (isOtpChallenge(data)) {
        return {
          otpRequired: true,
          otpChallengeId: data.otpChallengeId,
          sessionType: "system_user",
        };
      }

      const loginData = data as SystemUserLoginResponse;
      const tokens = extractTokens(loginData);
      const profile = extractProfile(loginData);

      setTokens(tokens, "system_user");
      dispatch(
        setSystemUserSession({ type: "system_user", tokens, profile })
      );
      navigate(getPostLoginPath("system_user", loginData.role));
      return { otpRequired: false };
    },
    [dispatch, navigate]
  );

  /**
   * Super admin global login (step 1 of dual-login flow).
   * POST /v1/system-users/super-admin/login
   */
  const loginSuperAdminGlobal = useCallback(
    async (credentials: LoginRequest): Promise<SuperAdminGlobalLoginResponse | LoginResult> => {
      const data = await apiPost<SuperAdminGlobalLoginResponse | OtpChallengeResponse>(
        "/system-users/super-admin/login",
        credentials
      );

      if (isOtpChallenge(data)) {
        return {
          otpRequired: true,
          otpChallengeId: data.otpChallengeId,
          sessionType: "system_user",
        };
      }

      const loginData = data as SuperAdminGlobalLoginResponse;
      // Store tokens from step 1 so the tenant-scoped call is authenticated
      const tokens = extractTokens(loginData.user);
      setTokens(tokens, "system_user");

      return loginData;
    },
    []
  );

  /**
   * Super admin tenant-scoped login (step 2 of dual-login flow).
   * POST /v1/system-users/tenant/{tenantId}/login
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
      navigate(getPostLoginPath("system_user", "super_admin"));
    },
    [dispatch, navigate]
  );

  /**
   * Verify OTP code during login (step 2 of 2FA flow).
   * POST /v1/admins/verify-otp or /v1/system-users/verify-otp
   *
   * On success, returns the full login profile + tokens.
   */
  const verifyOtp = useCallback(
    async (
      request: OtpVerifyRequest,
      sessionType: "admin" | "system_user"
    ) => {
      const endpoint =
        sessionType === "admin"
          ? "/admins/verify-otp"
          : "/system-users/verify-otp";

      const data = await apiPost<AdminLoginResponse | SystemUserLoginResponse>(
        endpoint,
        request
      );

      if (sessionType === "admin") {
        const adminData = data as AdminLoginResponse;
        const tokens = {
          accessToken: adminData.accessToken,
          refreshToken: adminData.refreshToken,
        };
        const profile = {
          id: adminData.Id,
          fullName: adminData.fullName,
          email: adminData.email,
        };

        setTokens(tokens, "admin");
        dispatch(setAdminSession({ type: "admin", tokens, profile }));
        navigate(getPostLoginPath("admin"));
      } else {
        const userData = data as SystemUserLoginResponse;
        const tokens = extractTokens(userData);
        const profile = extractProfile(userData);

        setTokens(tokens, "system_user");
        dispatch(
          setSystemUserSession({ type: "system_user", tokens, profile })
        );
        navigate(getPostLoginPath("system_user", userData.role));
      }
    },
    [dispatch, navigate]
  );

  /**
   * Logout: call backend to clear httpOnly cookies, then clear local state.
   */
  const logout = useCallback(async () => {
    const currentType = getSessionType();
    const logoutEndpoint =
      currentType === "admin" ? "/admins/logout" : "/system-users/logout";

    try {
      // Ask backend to clear the httpOnly cookies
      await apiClient.post(logoutEndpoint);
    } catch {
      // Best-effort — still clear local state even if this fails
    }

    clearTokens();
    dispatch(clearSessionState());
    dispatch(clearBranding());
    navigate(currentType === "admin" ? "/admin/login" : "/app/login");
  }, [dispatch, navigate]);

  return {
    loginAdmin,
    loginSystemUser,
    loginSuperAdminGlobal,
    loginSuperAdminTenant,
    verifyOtp,
    logout,
  };
}
