"use client";

import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/recipes/data-table";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useSession } from "@/hooks/use-session";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import { useTenantInvoices } from "@/features/invoices/hooks/use-invoices";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import type { Invoice, InvoiceStatus } from "@/types/billing";

/**
 * Invoice status badge color mapping
 */
function getInvoiceStatusVariant(status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "secondary";
    case "issued":
      return "default";
    case "draft":
      return "outline";
    case "void":
    case "refunded":
      return "destructive";
    default:
      return "default";
  }
}

/**
 * Format invoice status for display
 */
function formatInvoiceStatus(status: InvoiceStatus): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function BillingPage() {
  const { tenantId } = useSession();

  // Fetch usage summary
  const {
    data: usage,
    isLoading: usageLoading,
    isError: usageError,
    refetch: refetchUsage,
  } = useMyUsage();

  // Fetch invoices for this tenant
  const {
    data: invoicesResponse,
    isLoading: invoicesLoading,
    isError: invoicesError,
    refetch: refetchInvoices,
  } = useTenantInvoices(tenantId || "");

  const invoices = useMemo(() => invoicesResponse?.data || [], [invoicesResponse]);

  // Column definitions for invoices table
  const columnHelper = createColumnHelper<Invoice>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("invoiceNumber", {
        header: "Invoice Number",
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("totalMinor", {
        header: "Amount",
        cell: (info) => formatCurrency(info.getValue(), info.row.original.currency),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <Badge variant={getInvoiceStatusVariant(info.getValue())}>
            {formatInvoiceStatus(info.getValue())}
          </Badge>
        ),
      }),
      columnHelper.accessor("issuedAt", {
        header: "Issued Date",
        cell: (info) => (info.getValue() ? formatDate(info.getValue()) : "—"),
      }),
      columnHelper.accessor("id", {
        header: "Actions",
        cell: (info) => (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 gap-2"
            disabled={!info.row.original.pdfUrl}
            title={info.row.original.pdfUrl ? "View PDF" : "PDF not available"}
          >
            <a
              href={info.row.original.pdfUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">View PDF</span>
            </a>
          </Button>
        ),
      }),
    ],
    [columnHelper]
  );

  // Show loading state
  if (usageLoading || !tenantId) {
    return <PageSkeleton />;
  }

  // Show error state
  if (usageError) {
    return (
      <ErrorState
        title="Failed to load billing information"
        onRetry={() => {
          refetchUsage();
          refetchInvoices();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Usage"
        description="View your subscription plan, usage, and invoices"
      />

      {/* Usage Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Current Plan"
          value={usage?.planName ?? "—"}
          description="Active subscription plan"
        />
        <StatCard
          title="Plan Tier"
          value={usage?.planTier ?? "—"}
          description="Your plan level"
        />
        <StatCard
          title="Subscription Status"
          value={
            usage?.subscriptionStatus
              ? usage.subscriptionStatus
                  .split("_")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")
              : "—"
          }
          description="Current subscription state"
        />
      </div>

      {/* Storage Usage Card */}
      {usage?.storage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Documents */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Documents</span>
                <span className="text-sm text-muted-foreground">
                  {usage.storage.documentsUsed}
                  {usage.storage.documentsLimit != null &&
                    ` / ${usage.storage.documentsLimit}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      usage.storage.documentsLimit &&
                      usage.storage.documentsLimit > 0
                        ? `${Math.min(
                            (usage.storage.documentsUsed /
                              usage.storage.documentsLimit) *
                              100,
                            100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            {/* Storage MB */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Storage</span>
                <span className="text-sm text-muted-foreground">
                  {usage.storage.storageMbUsed.toFixed(1)} MB
                  {usage.storage.storageMbLimit != null &&
                    ` / ${usage.storage.storageMbLimit} MB`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      usage.storage.storageMbLimit &&
                      usage.storage.storageMbLimit > 0
                        ? `${Math.min(
                            (usage.storage.storageMbUsed /
                              usage.storage.storageMbLimit) *
                              100,
                            100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={invoices}
            isLoading={invoicesLoading}
            pagination={true}
            pageSize={10}
            emptyTitle="No invoices"
            emptyDescription="You don't have any invoices yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
