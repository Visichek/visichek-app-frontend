"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invoice, PaymentTransaction, PaymentIntentRequest } from "@/types/billing";
import type { InvoiceStatus } from "@/types/enums";

interface UseInvoicesParams {
  tenantId?: string;
  status?: InvoiceStatus;
  start?: number;
  stop?: number;
}

interface UseTenantInvoicesParams {
  start?: number;
  stop?: number;
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
  return useQuery<InvoiceWithSummary[]>({
    queryKey: ["invoices", "admin", params],
    queryFn: () =>
      apiGet<InvoiceWithSummary[]>("/invoices/admin", {
        tenant_id: params?.tenantId,
        status: params?.status,
        start: params?.start ?? 0,
        stop: params?.stop ?? 50,
      }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch invoices for a specific tenant (super_admin role).
 */
export function useTenantInvoices(tenantId: string, params?: UseTenantInvoicesParams) {
  return useQuery<InvoiceWithSummary[]>({
    queryKey: ["invoices", "tenant", tenantId, params],
    queryFn: () =>
      apiGet<InvoiceWithSummary[]>(`/invoices/tenant/${tenantId}`, {
        start: params?.start ?? 0,
        stop: params?.stop ?? 20,
      }),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
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
