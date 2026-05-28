import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import { resolveDocumentUrl } from "@/lib/utils/document-url";
import type {
  PublicTenantInfo,
  PublicDepartment,
  PublicPrivacyNotice,
  PublicRegistrationRequest,
  PublicRegistrationResponse,
  AppointmentPrefillData,
  PublicCheckoutRequest,
  PublicCheckoutResponse,
  PublicRightsRequest,
  PublicRightsResponse,
  PublicRightsStatusResponse,
  PublicConsentWithdrawalRequest,
  PublicConsentWithdrawalResponse,
  PublicProfilingOptOutRequest,
  PublicProfilingOptOutResponse,
  PublicTokenVerifyResponse,
  PublicOcrScanResponse,
  PublicLookupRequest,
  PublicLookupResponse,
  PublicFinalizeRequest,
  PublicFinalizeResponse,
  PublicBadgePass,
} from "@/types/public";

// ── Query Keys ───────────────────────────────────────────────────────

export const publicKeys = {
  all: ["public"] as const,
  tenantInfo: (tenantId: string) =>
    ["public", "tenant-info", tenantId] as const,
  departments: (tenantId: string) =>
    ["public", "departments", tenantId] as const,
  privacyNotice: (tenantId: string) =>
    ["public", "privacy-notice", tenantId] as const,
  appointmentPrefill: (tenantId: string, appointmentId: string) =>
    ["public", "appointment-prefill", tenantId, appointmentId] as const,
  rightsStatus: (requestId: string) =>
    ["public", "rights-status", requestId] as const,
  tokenVerify: (token: string) =>
    ["public", "token-verify", token] as const,
  badge: (token: string) => ["public", "badge", token] as const,
};

// ── Registration token verify ────────────────────────────────────────

export function useVerifyRegistrationToken(token: string | null) {
  return useQuery({
    queryKey: publicKeys.tokenVerify(token ?? ""),
    queryFn: () =>
      apiGet<PublicTokenVerifyResponse>("/public/register/verify", {
        token: token,
      }),
    enabled: !!token,
    staleTime: 60 * 1000,
    retry: 0,
  });
}

// ── Public OCR ID scan ───────────────────────────────────────────────

export function usePublicOcrIdScan(tenantId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiPost<PublicOcrScanResponse>(
        `/public/register/${tenantId}/id-scan`,
        form
      );
    },
  });
}

// ── Returning-visitor lookup ─────────────────────────────────────────

export function usePublicLookup(tenantId: string) {
  return useMutation({
    mutationFn: (data: PublicLookupRequest) =>
      apiPost<PublicLookupResponse>(
        `/public/register/${tenantId}/lookup`,
        data
      ),
  });
}

// ── Finalize via receptionist code ───────────────────────────────────

export function usePublicFinalize(tenantId: string) {
  return useMutation({
    mutationFn: (data: PublicFinalizeRequest) =>
      apiPost<PublicFinalizeResponse>(
        `/public/register/${tenantId}/finalize`,
        data
      ),
  });
}

// ── Printable Badge Pass (by token) ──────────────────────────────────

/**
 * Sentinel token that renders the badge with mock data instead of hitting
 * the backend, so the print template can be designed/iterated at
 * `/badge/test-badge-token` without a live check-in. Real tokens are opaque
 * badge QR tokens and will never collide with this value.
 */
export const TEST_BADGE_TOKEN = "test-badge-token";

const TEST_BADGE_PASS: PublicBadgePass = {
  token: TEST_BADGE_TOKEN,
  visitorName: "Nathaniel Uriri",
  company: "Introgroup Technologies",
  purpose: "Quarterly partnership review",
  hostName: "Ada Receptionist",
  departmentName: "Operations",
  status: "checked_in",
  issuedAt: Math.floor(Date.now() / 1000),
  expiresAt: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  tenant: {
    companyName: "Doux Finance",
    logoUrl: "/visichek_logo.svg",
    brandingEnabled: true,
  },
};

export function usePublicBadge(token: string | null) {
  return useQuery({
    queryKey: publicKeys.badge(token ?? ""),
    queryFn: async (): Promise<PublicBadgePass> => {
      if (token === TEST_BADGE_TOKEN) return TEST_BADGE_PASS;
      const data = await apiGet<PublicBadgePass>(`/public/badge/${token}`);
      return {
        ...data,
        tenant: {
          ...data.tenant,
          logoUrl:
            resolveDocumentUrl(data.tenant.logoUrl) ?? data.tenant.logoUrl,
        },
      };
    },
    enabled: !!token,
    staleTime: 60 * 1000,
    retry: 0,
  });
}

// ── Tenant Info ──────────────────────────────────────────────────────

export function usePublicTenantInfo(tenantId: string) {
  return useQuery({
    queryKey: publicKeys.tenantInfo(tenantId),
    queryFn: async () => {
      const data = await apiGet<PublicTenantInfo>(
        `/public/register/${tenantId}/info`
      );
      return {
        ...data,
        logoUrl: resolveDocumentUrl(data.logoUrl) ?? data.logoUrl,
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes — tenant info changes rarely
    retry: 1,
  });
}

// ── Departments ──────────────────────────────────────────────────────

export function usePublicDepartments(tenantId: string) {
  return useQuery({
    queryKey: publicKeys.departments(tenantId),
    queryFn: () =>
      apiGet<PublicDepartment[]>(`/public/register/${tenantId}/departments`),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Privacy Notice ───────────────────────────────────────────────────

export function usePublicPrivacyNotice(tenantId: string) {
  return useQuery({
    queryKey: publicKeys.privacyNotice(tenantId),
    queryFn: () =>
      apiGet<PublicPrivacyNotice | null>(
        `/public/register/${tenantId}/privacy-notice`
      ),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Appointment Prefill ──────────────────────────────────────────────

export function useAppointmentPrefill(
  tenantId: string,
  appointmentId: string | null
) {
  return useQuery({
    queryKey: publicKeys.appointmentPrefill(
      tenantId,
      appointmentId ?? ""
    ),
    queryFn: () =>
      apiGet<AppointmentPrefillData>(
        `/public/register/${tenantId}/appointment/${appointmentId}`
      ),
    enabled: !!tenantId && !!appointmentId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Public Registration Mutation ─────────────────────────────────────

export function usePublicRegister(tenantId: string) {
  return useMutation({
    mutationFn: (data: PublicRegistrationRequest) =>
      apiPost<PublicRegistrationResponse>(
        `/public/register/${tenantId}`,
        data
      ),
  });
}

// ── Public Checkout Mutation ─────────────────────────────────────────

export function usePublicCheckout() {
  return useMutation({
    mutationFn: (data: PublicCheckoutRequest) =>
      apiPost<PublicCheckoutResponse>("/public/checkout", data),
  });
}

// ── Public Rights Request Mutation ───────────────────────────────────

export function usePublicRightsRequest() {
  return useMutation({
    mutationFn: (data: PublicRightsRequest) =>
      apiPost<PublicRightsResponse>("/public/rights/request", data),
  });
}

// ── Public Rights Status Query ───────────────────────────────────────

export function usePublicRightsStatus(
  requestId: string,
  verificationToken: string
) {
  return useQuery({
    queryKey: publicKeys.rightsStatus(requestId),
    queryFn: () =>
      apiGet<PublicRightsStatusResponse>(
        `/public/rights/request/${requestId}/status`,
        { verificationToken: verificationToken }
      ),
    enabled: !!requestId && !!verificationToken,
    retry: 1,
  });
}

// ── Consent Withdrawal ──────────────────────────────────────────────

export function usePublicConsentWithdrawal() {
  return useMutation({
    mutationFn: (data: PublicConsentWithdrawalRequest) =>
      apiPost<PublicConsentWithdrawalResponse>(
        "/public/rights/withdraw-consent",
        data
      ),
  });
}

// ── Profiling Opt-Out ────────────────────────────────────────────────

export function usePublicProfilingOptOut() {
  return useMutation({
    mutationFn: (data: PublicProfilingOptOutRequest) =>
      apiPatch<PublicProfilingOptOutResponse>(
        "/public/rights/profiling-opt-out",
        data
      ),
  });
}
