"use client";

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  setAdminSession,
  setSystemUserSession,
  clearSessionState,
  selectSessionType,
} from "@/lib/store/session-slice";
import { clearBranding } from "@/lib/store/branding-slice";
import { apiPost } from "@/lib/api/request";
import apiClient from "@/lib/api/client";
import { getPostLoginPath } from "@/lib/routing/redirects";
import {
  isOtpChallenge,
  isTenantSelectionRequired,
  type OtpChallengeResponse,
  type OtpVerifyRequest,
  type TenantSelectionCandidate,
  type TenantSelectionResponse,
  type SelectTenantRequest,
} from "@/types/account";
import type {
  LoginRequest,
  AdminLoginResponse,
  SystemUserLoginResponse,
  SuperAdminGlobalLoginResponse,
} from "@/types/auth";

/**
 * Auth tokens live in httpOnly cookies set by the backend on every login
 * call. The frontend never persists or attaches tokens — login responses
 * still carry an accessToken/refreshToken pair, but those fields are
 * ignored here. We only extract the profile and dispatch it to Redux so
 * the UI knows who is logged in.
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
 * Result from a login attempt.
 *
 *   - "complete":         hook already redirected to the dashboard
 *   - "otp":              caller should mount the OTP screen and call verifyOtp
 *   - "tenant_selection": caller should render the workspace chooser and
 *                         call selectTenant once the user picks one. The
 *                         selectionToken is single-use, 5-min TTL,
 *                         memory-only — never persist it.
 */
export type LoginResult =
  | { kind: "complete" }
  | {
      kind: "otp";
      otpChallengeId: string;
      sessionType: "admin" | "system_user";
    }
  | {
      kind: "tenant_selection";
      selectionToken: string;
      tenants: TenantSelectionCandidate[];
    };

const EMPTY_TOKENS = { accessToken: "", refreshToken: "" };

export function useAuth() {
  const dispatch = useAppDispatch();
  const sessionType = useAppSelector(selectSessionType);
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

      if (isOtpChallenge(data)) {
        return {
          kind: "otp",
          otpChallengeId: data.otpChallengeId,
          sessionType: "admin",
        };
      }

      const loginData = data as AdminLoginResponse;
      const profile = {
        id: loginData.id,
        fullName: loginData.fullName,
        email: loginData.email,
      };

      dispatch(setAdminSession({ type: "admin", tokens: EMPTY_TOKENS, profile }));
      navigate(getPostLoginPath("admin"));
      return { kind: "complete" };
    },
    [dispatch, navigate]
  );

  /**
   * Tenant staff login (receptionist, dept_admin, auditor, security_officer, dpo).
   * POST /v1/system-users/login
   *
   * Email + password only — the backend figures out which tenant(s) the
   * email belongs to. The response is one of three shapes:
   *
   *   1. Complete (single tenant, no MFA) → cookies set, hook redirects
   *   2. OTP required (single tenant, MFA on) → caller shows OTP screen
   *   3. Tenant selection required (multi-tenant) → caller shows workspace
   *      chooser, then calls selectTenant() with the user's choice
   */
  const loginSystemUser = useCallback(
    async (credentials: LoginRequest): Promise<LoginResult> => {
      const data = await apiPost<
        | SystemUserLoginResponse
        | OtpChallengeResponse
        | TenantSelectionResponse
      >("/system-users/login", credentials);

      if (isTenantSelectionRequired(data)) {
        return {
          kind: "tenant_selection",
          selectionToken: data.selectionToken,
          tenants: data.tenants,
        };
      }

      if (isOtpChallenge(data)) {
        return {
          kind: "otp",
          otpChallengeId: data.otpChallengeId,
          sessionType: "system_user",
        };
      }

      const loginData = data as SystemUserLoginResponse;
      const profile = extractProfile(loginData);

      dispatch(
        setSystemUserSession({
          type: "system_user",
          tokens: EMPTY_TOKENS,
          profile,
        })
      );
      navigate(getPostLoginPath("system_user", loginData.role));
      return { kind: "complete" };
    },
    [dispatch, navigate]
  );

  /**
   * Stage 2 of the multi-tenant login flow. Submit the chosen tenant
   * alongside the selectionToken returned by loginSystemUser.
   * POST /v1/system-users/select-tenant
   *
   * Returns "otp" when the chosen tenant has MFA on, otherwise "complete".
   * A 401 here means the selectionToken is invalid/used/expired (5-min
   * TTL) — the caller should send the user back to the login screen.
   */
  const selectTenant = useCallback(
    async (request: SelectTenantRequest): Promise<LoginResult> => {
      const data = await apiPost<
        SystemUserLoginResponse | OtpChallengeResponse
      >("/system-users/select-tenant", request);

      if (isOtpChallenge(data)) {
        return {
          kind: "otp",
          otpChallengeId: data.otpChallengeId,
          sessionType: "system_user",
        };
      }

      const loginData = data as SystemUserLoginResponse;
      const profile = extractProfile(loginData);

      dispatch(
        setSystemUserSession({
          type: "system_user",
          tokens: EMPTY_TOKENS,
          profile,
        })
      );
      navigate(getPostLoginPath("system_user", loginData.role));
      return { kind: "complete" };
    },
    [dispatch, navigate]
  );

  /**
   * Super admin global login (step 1 of dual-login flow).
   * POST /v1/system-users/super-admin/login
   *
   * The cookie set here is what authenticates the tenant-scoped step-2
   * call — there is no token to capture client-side.
   */
  const loginSuperAdminGlobal = useCallback(
    async (credentials: LoginRequest): Promise<SuperAdminGlobalLoginResponse | LoginResult> => {
      const data = await apiPost<SuperAdminGlobalLoginResponse | OtpChallengeResponse>(
        "/system-users/super-admin/login",
        credentials
      );

      if (isOtpChallenge(data)) {
        return {
          kind: "otp",
          otpChallengeId: data.otpChallengeId,
          sessionType: "system_user",
        };
      }

      return data as SuperAdminGlobalLoginResponse;
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

      const profile = extractProfile(data);
      dispatch(
        setSystemUserSession({
          type: "system_user",
          tokens: EMPTY_TOKENS,
          profile,
        })
      );
      navigate(getPostLoginPath("system_user", "super_admin"));
    },
    [dispatch, navigate]
  );

  /**
   * Verify OTP code during login (step 2 of 2FA flow).
   * POST /v1/admins/verify-otp or /v1/system-users/verify-otp
   *
   * On success, returns the full login profile.
   */
  const verifyOtp = useCallback(
    async (
      request: OtpVerifyRequest,
      type: "admin" | "system_user"
    ) => {
      const endpoint =
        type === "admin"
          ? "/admins/verify-otp"
          : "/system-users/verify-otp";

      const data = await apiPost<AdminLoginResponse | SystemUserLoginResponse>(
        endpoint,
        request
      );

      if (type === "admin") {
        const adminData = data as AdminLoginResponse;
        const profile = {
          id: adminData.id,
          fullName: adminData.fullName,
          email: adminData.email,
        };
        dispatch(setAdminSession({ type: "admin", tokens: EMPTY_TOKENS, profile }));
        navigate(getPostLoginPath("admin"));
      } else {
        const userData = data as SystemUserLoginResponse;
        const profile = extractProfile(userData);
        dispatch(
          setSystemUserSession({
            type: "system_user",
            tokens: EMPTY_TOKENS,
            profile,
          })
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
    const logoutEndpoint =
      sessionType === "admin" ? "/admins/logout" : "/system-users/logout";

    try {
      await apiClient.post(logoutEndpoint);
    } catch {
      // Best-effort — still clear local state even if this fails.
    }

    dispatch(clearSessionState());
    dispatch(clearBranding());
    navigate(sessionType === "admin" ? "/admin/login" : "/app/login");
  }, [dispatch, navigate, sessionType]);

  return {
    loginAdmin,
    loginSystemUser,
    selectTenant,
    loginSuperAdminGlobal,
    loginSuperAdminTenant,
    verifyOtp,
    logout,
  };
}
