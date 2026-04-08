"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { Invoice } from "@/types/billing";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    skip?: number;
    limit?: number;
    total?: number;
  };
}

/**
 * Fetch all invoices (admin view)
 */
export function useAllInvoices() {
  return useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["invoices", "admin"],
    queryFn: () => apiGet<PaginatedResponse<Invoice>>("/invoices/admin"),
  });
}

/**
 * Fetch invoices for a specific tenant
 */
export function useTenantInvoices(tenantId: string) {
  return useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["invoices", "tenant", tenantId],
    queryFn: () => apiGet<PaginatedResponse<Invoice>>(`/invoices/tenant/${tenantId}`),
    enabled: !!tenantId,
  });
}

/**
 * Fetch a single invoice by ID
 */
export function useInvoice(invoiceId: string) {
  return useQuery<Invoice>({
    queryKey: ["invoices", invoiceId],
    queryFn: () => apiGet<Invoice>(`/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });
}
