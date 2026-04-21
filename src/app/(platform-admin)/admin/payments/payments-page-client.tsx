"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useAllInvoices,
  useInvoice,
  usePaymentTransaction,
  fetchInvoicePdfUrl,
  type InvoiceWithSummary,
} from "@/features/invoices/hooks/use-invoices";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { DetailSheet } from "@/components/recipes/detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format-currency";
import type { InvoiceStatus } from "@/types/enums";

const STATUS_OPTIONS: Array<{ value: InvoiceStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "issued", label: "Issued" },
  { value: "draft", label: "Draft" },
  { value: "void", label: "Void" },
  { value: "refunded", label: "Refunded" },
];

const PAGE_SIZE = 50;

function statusVariant(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "issued":
      return "info" as const;
    case "draft":
      return "secondary" as const;
    case "void":
      return "warning" as const;
    case "refunded":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function PaymentsPageClient() {
  const [statusFilter, setStatusFilter] = React.useState<InvoiceStatus | "all">("all");
  const [start, setStart] = React.useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = React.useState<string | null>(null);

  const queryParams = React.useMemo(
    () => ({
      start,
      stop: start + PAGE_SIZE,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [start, statusFilter]
  );

  // Match the SSR prefetch key exactly when filters are at their defaults so
  // hydration lands on the cached payload instead of refetching.
  const { data, isLoading, isError, refetch, isFetching } = useAllInvoices(queryParams);
  const invoices = data ?? [];

  const handleDownloadPdf = React.useCallback(async (invoiceId: string) => {
    setPdfLoadingId(invoiceId);
    try {
      const url = await fetchInvoicePdfUrl(invoiceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not generate a download link — the PDF may not be ready yet."
      );
    } finally {
      setPdfLoadingId(null);
    }
  }, []);

  const columns: ColumnDef<InvoiceWithSummary>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div>
            <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">
              {capitalize(invoice.billingCycle)}
            </p>
          </div>
        );
      },
    },
    {
      id: "tenant",
      header: "Tenant",
      cell: ({ row }) => {
        const invoice = row.original;
        const name = invoice.tenantSummary?.companyName ?? invoice.tenantId;
        return (
          <div className="min-w-0">
            <p className="text-sm truncate">{name}</p>
            {invoice.tenantSummary?.companyName && (
              <p className="text-xs text-muted-foreground truncate">
                {invoice.tenantId}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <span className="text-sm text-muted-foreground">
            {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
          </span>
        );
      },
    },
    {
      accessorKey: "totalMinor",
      header: "Amount",
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <span className="text-sm font-medium">
            {formatCurrency(invoice.totalMinor, invoice.currency || "NGN")}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as InvoiceStatus;
        return (
          <Badge variant={statusVariant(status)}>
            {capitalize(status.replace(/_/g, " "))}
          </Badge>
        );
      },
    },
    {
      id: "paidAt",
      header: "Paid",
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <span className="text-sm text-muted-foreground">
            {invoice.paidAt ? formatDate(invoice.paidAt) : "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "provider",
      header: "Provider",
      cell: ({ row }) => {
        const provider = row.getValue("provider") as string | undefined;
        if (!provider) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return <span className="text-sm capitalize">{provider}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const invoice = row.original;
        const isPdfLoading = pdfLoadingId === invoice.id;
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 min-h-[44px]"
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                  aria-label={`View details for invoice ${invoice.invoiceNumber}`}
                >
                  View
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Open this invoice to see line items, the tenant summary, and the
                linked payment transaction
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 min-h-[44px] min-w-[44px]"
                  disabled={isPdfLoading}
                  onClick={() => handleDownloadPdf(invoice.id)}
                  aria-label={`Download PDF for invoice ${invoice.invoiceNumber}`}
                >
                  {isPdfLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Generate a fresh presigned URL and open the invoice PDF in a new
                tab
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  const hasNextPage = invoices.length === PAGE_SIZE;
  const hasPrevPage = start > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Every successful charge produces an invoice — review them here, download PDFs, and drill into the underlying payment transaction."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh invoice list"
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Bypass the 2-minute admin cache and pull the latest invoices from
              the server
            </TooltipContent>
          </Tooltip>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full md:w-56">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as InvoiceStatus | "all");
                    setStart(0);
                  }}
                >
                  <SelectTrigger className="min-h-[44px]" aria-label="Filter invoices by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Narrow the list by invoice status — paid, issued (unpaid), draft,
              void, or refunded
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={!hasPrevPage || isFetching}
                onClick={() => setStart((s) => Math.max(0, s - PAGE_SIZE))}
              >
                Previous
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Load the previous {PAGE_SIZE} invoices in this filtered view
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-muted-foreground">
            {start + 1}–{start + invoices.length}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={!hasNextPage || isFetching}
                onClick={() => setStart((s) => s + PAGE_SIZE)}
              >
                Next
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Load the next {PAGE_SIZE} invoices in this filtered view
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load invoices.{" "}
            <button
              onClick={() => refetch()}
              className="underline hover:opacity-70"
            >
              Try again
            </button>
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          searchKey="invoiceNumber"
          searchPlaceholder="Search invoice number or tenant..."
          isLoading={isLoading}
          pagination={false}
          emptyTitle="No invoices yet"
          emptyDescription="Invoices are generated automatically when subscriptions renew. Once a tenant is charged, the invoice will appear here."
          mobileCard={(invoice) => (
            <button
              type="button"
              onClick={() => setSelectedInvoiceId(invoice.id)}
              className="w-full text-left rounded-lg border p-4 space-y-3 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {invoice.tenantSummary?.companyName ?? invoice.tenantId}
                  </p>
                </div>
                <Badge variant={statusVariant(invoice.status)}>
                  {capitalize(invoice.status.replace(/_/g, " "))}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {formatCurrency(invoice.totalMinor, invoice.currency || "NGN")}
                </span>
                {invoice.provider && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {invoice.provider}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
              </div>
              <div className="text-xs text-muted-foreground">
                {invoice.paidAt
                  ? `Paid ${formatDate(invoice.paidAt)}`
                  : invoice.issuedAt
                  ? `Issued ${formatDate(invoice.issuedAt)}`
                  : "Not yet issued"}
              </div>
            </button>
          )}
        />
      )}

      <InvoiceDetailSheet
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onDownloadPdf={handleDownloadPdf}
        pdfLoadingId={pdfLoadingId}
      />
    </div>
  );
}

interface InvoiceDetailSheetProps {
  invoiceId: string | null;
  onClose: () => void;
  onDownloadPdf: (invoiceId: string) => void | Promise<void>;
  pdfLoadingId: string | null;
}

function InvoiceDetailSheet({
  invoiceId,
  onClose,
  onDownloadPdf,
  pdfLoadingId,
}: InvoiceDetailSheetProps) {
  const { data: invoice, isLoading, isError, refetch } = useInvoice(invoiceId);
  const paymentId = invoice?.paymentTransactionId;
  const { data: payment } = usePaymentTransaction(paymentId);

  const receiptUrl =
    payment && typeof payment.responsePayload === "object" && payment.responsePayload
      ? (payment.responsePayload as Record<string, unknown>)["receipt_url"]
      : undefined;

  return (
    <DetailSheet
      open={!!invoiceId}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={invoice ? invoice.invoiceNumber : "Invoice"}
      description={
        invoice
          ? `${capitalize(invoice.billingCycle)} invoice · ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
          : undefined
      }
      actions={
        invoice ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={onClose}
                >
                  Close
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close this invoice detail panel</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="min-h-[44px]"
                  disabled={pdfLoadingId === invoice.id}
                  onClick={() => onDownloadPdf(invoice.id)}
                  aria-label={`Download PDF for invoice ${invoice.invoiceNumber}`}
                >
                  {pdfLoadingId === invoice.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Download PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Generate a fresh presigned URL and open the invoice PDF in a new
                tab
              </TooltipContent>
            </Tooltip>
          </>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : isError || !invoice ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Could not load invoice details.{" "}
            <button onClick={() => refetch()} className="underline">
              Try again
            </button>
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
              <Badge variant={statusVariant(invoice.status)}>
                {capitalize(invoice.status.replace(/_/g, " "))}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}</dd>
              <dt className="text-muted-foreground">Paid</dt>
              <dd>{invoice.paidAt ? formatDate(invoice.paidAt) : "—"}</dd>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="capitalize">{invoice.provider ?? "—"}</dd>
              <dt className="text-muted-foreground">Billing cycle</dt>
              <dd className="capitalize">{invoice.billingCycle}</dd>
            </dl>
          </section>

          {invoice.tenantSummary && (
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium text-muted-foreground">Tenant</h3>
              <p className="text-sm font-medium">
                {invoice.tenantSummary.companyName ?? invoice.tenantId}
              </p>
              <p className="text-xs text-muted-foreground">
                {invoice.tenantId}
              </p>
              {invoice.tenantSummary.countryOfHosting && (
                <p className="text-xs text-muted-foreground">
                  Hosted in {invoice.tenantSummary.countryOfHosting}
                </p>
              )}
            </section>
          )}

          <section className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Line items
            </h3>
            <div className="space-y-2">
              {invoice.lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">{item.description}</p>
                    {item.quantity !== 1 && (
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity} ×{" "}
                        {formatCurrency(item.unitPriceMinor, invoice.currency || "NGN")}
                      </p>
                    )}
                  </div>
                  <span className="font-medium shrink-0">
                    {formatCurrency(item.totalMinor, invoice.currency || "NGN")}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>
                  {formatCurrency(invoice.subtotalMinor, invoice.currency || "NGN")}
                </span>
              </div>
              {invoice.discountTotalMinor > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span>
                  <span>
                    −{formatCurrency(invoice.discountTotalMinor, invoice.currency || "NGN")}
                  </span>
                </div>
              )}
              {invoice.taxMinor > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>
                    {formatCurrency(invoice.taxMinor, invoice.currency || "NGN")}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t">
                <span>Total</span>
                <span>
                  {formatCurrency(invoice.totalMinor, invoice.currency || "NGN")}
                </span>
              </div>
            </div>
          </section>

          {payment && (
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Payment transaction
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="truncate">{payment.reference}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{payment.status}</dd>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="capitalize">{payment.provider}</dd>
                <dt className="text-muted-foreground">Charged</dt>
                <dd>{formatDate(payment.updatedAt)}</dd>
              </dl>
              {typeof receiptUrl === "string" && receiptUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary underline"
                    >
                      View provider receipt
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    Open the provider's hosted receipt page in a new tab
                  </TooltipContent>
                </Tooltip>
              )}
            </section>
          )}
        </>
      )}
    </DetailSheet>
  );
}
