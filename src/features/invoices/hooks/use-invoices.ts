"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import { bulkAction } from "@/lib/api/bulk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invoice, PaymentTransaction, PaymentIntentRequest } from "@/types/billing";
import type { InvoiceStatus } from "@/types/enums";
import type { ListResponse, BulkJobResult } from "@/types/list";

interface UseInvoicesParams {
  tenantId?: string;
  status?: InvoiceStatus;
  amountGte?: number;
  amountLte?: number;
  issuedAtGte?: number;
  issuedAtLte?: number;
  q?: string;
  sort?: string;
  facets?: string;
  skip?: number;
  limit?: number;
}

interface UseTenantInvoicesParams {
  status?: InvoiceStatus;
  amountGte?: number;
  amountLte?: number;
  issuedAtGte?: number;
  issuedAtLte?: number;
  sort?: string;
  facets?: string;
  skip?: number;
  limit?: number;
}

export interface InvoiceWithSummary extends Invoice {
  tenantSummary?: {
    id: string;
    companyName?: string;
    isActive?: boolean;
    countryOfHosting?: string | null;
  } | null;
  subscriptionSummary?: {
    id: string;
    status?: string;
    billingCycle?: string;
    planId?: string;
    currentPeriodEnd?: number;
  } | null;
}

/**
 * Fetch all invoices (admin). The axios interceptor unwraps the envelope, so
 * this returns the flat Invoice[] array. Pagination meta (total, start, stop)
 * is discarded on the client — use `start`/`stop` params to page through.
 */
export function useAllInvoices(params?: UseInvoicesParams) {
  return useQuery<ListResponse<InvoiceWithSummary>>({
    queryKey: ["invoices", "admin", params],
    queryFn: () =>
      apiGetList<InvoiceWithSummary>("/invoices/admin", {
        tenantId: params?.tenantId,
        status: params?.status,
        amountGte: params?.amountGte,
        amountLte: params?.amountLte,
        issuedAtGte: params?.issuedAtGte,
        issuedAtLte: params?.issuedAtLte,
        q: params?.q,
        sort: params?.sort ?? "-issuedAt",
        facets: params?.facets,
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 50,
      }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch invoices for a specific tenant (super_admin role).
 */
export function useTenantInvoices(tenantId: string, params?: UseTenantInvoicesParams) {
  return useQuery<ListResponse<InvoiceWithSummary>>({
    queryKey: ["invoices", "tenant", tenantId, params],
    queryFn: () =>
      apiGetList<InvoiceWithSummary>(`/invoices/tenant/${tenantId}`, {
        status: params?.status,
        amountGte: params?.amountGte,
        amountLte: params?.amountLte,
        issuedAtGte: params?.issuedAtGte,
        issuedAtLte: params?.issuedAtLte,
        sort: params?.sort ?? "-issuedAt",
        facets: params?.facets,
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 20,
      }),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Bulk download / void admin invoices per tables.txt §1.4.
 */
export function useBulkInvoiceAction(action: "download" | "void") {
  const queryClient = useQueryClient();
  return useMutation<
    BulkJobResult,
    Error,
    { ids: string[]; reason?: string; atomic?: boolean }
  >({
    mutationFn: ({ ids, reason, atomic }) =>
      bulkAction(`/invoices/bulk/${action}`, ids, {
        atomic,
        extras: action === "void" && reason ? { reason } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/**
 * Bulk download tenant-scoped invoices (returns presigned URLs per id) per
 * tables.txt §2.6.
 */
export function useBulkTenantInvoiceDownload(tenantId: string) {
  return useMutation<BulkJobResult, Error, { ids: string[]; atomic?: boolean }>({
    mutationFn: ({ ids, atomic }) =>
      bulkAction(`/invoices/tenant/${tenantId}/bulk/download`, ids, { atomic }),
  });
}

/**
 * Fetch a single invoice by ID (returns InvoiceWithSummaryOut).
 */
export function useInvoice(invoiceId: string | null) {
  return useQuery<InvoiceWithSummary>({
    queryKey: ["invoices", invoiceId],
    queryFn: () => apiGet<InvoiceWithSummary>(`/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

/**
 * Fetch the payment transaction that settled an invoice.
 */
export function usePaymentTransaction(paymentId: string | null | undefined) {
  return useQuery<PaymentTransaction>({
    queryKey: ["payments", paymentId],
    queryFn: () => apiGet<PaymentTransaction>(`/payments/${paymentId}`),
    enabled: !!paymentId,
  });
}

/**
 * Request a short-lived presigned URL for the invoice PDF. The URL is not
 * cached — call this every time the user clicks Download.
 */
export async function fetchInvoicePdfUrl(invoiceId: string): Promise<string> {
  const result = await apiGet<{ pdfUrl: string }>(`/invoices/${invoiceId}/pdf`);
  return result.pdfUrl;
}

/**
 * Start a payment — returns the PaymentTransaction whose `responsePayload`
 * contains `authorization_url` (redirect target) or `client_secret` (Stripe Elements).
 */
export function useCreatePaymentIntent() {
  const queryClient = useQueryClient();

  return useMutation<PaymentTransaction, Error, PaymentIntentRequest>({
    mutationFn: (body) => apiPost<PaymentTransaction>("/payments/intents", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/**
 * Refund a payment. Omit amountMinor for a full refund.
 */
export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentTransaction,
    Error,
    { paymentId: string; amountMinor?: number }
  >({
    mutationFn: ({ paymentId, amountMinor }) =>
      apiPost<PaymentTransaction>(`/payments/${paymentId}/refund`, { amount_minor: amountMinor }),
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ["payments", payment.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
