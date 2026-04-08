import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
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
};

// ── Tenant Info ──────────────────────────────────────────────────────

export function usePublicTenantInfo(tenantId: string) {
  return useQuery({
    queryKey: publicKeys.tenantInfo(tenantId),
    queryFn: () =>
      apiGet<PublicTenantInfo>(`/public/register/${tenantId}/info`),
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
