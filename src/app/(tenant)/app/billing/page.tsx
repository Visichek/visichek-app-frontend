"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable } from "@/components/recipes/data-table";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useSession } from "@/hooks/use-session";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import { useTenantInvoices } from "@/features/invoices/hooks/use-invoices";
import { useActiveSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { PlanPickerModal } from "@/features/checkout/components/plan-picker-modal";
import { CheckoutHistoryTable } from "@/features/checkout/components/checkout-history-table";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import type { Invoice } from "@/types/billing";
import type { InvoiceStatus } from "@/types/enums";

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
  const { tenantId, currentRole } = useSession();
  const canManageBilling = currentRole === "super_admin";

  const [planPickerOpen, setPlanPickerOpen] = useState(false);

  // Fetch usage summary
  const {
    data: usage,
    isLoading: usageLoading,
    isError: usageError,
    error: usageErrorObj,
    refetch: refetchUsage,
  } = useMyUsage();

  // Fetch invoices for this tenant
  const {
    data: invoicesResponse,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useTenantInvoices(tenantId || "");

  // Active subscription — used to highlight the current plan in the picker.
  // Safe to skip for non-managers since they can't open the picker anyway.
  const { data: activeSubscription } = useActiveSubscription(
    canManageBilling ? tenantId || "" : ""
  );

  const invoices = useMemo(() => invoicesResponse?.data || [], [invoicesResponse]);

  // Column definitions for invoices table
  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice Number",
        cell: ({ row }) => row.original.invoiceNumber || "—",
      },
      {
        accessorKey: "totalMinor",
        header: "Amount",
        cell: ({ row }) =>
          formatCurrency(row.original.totalMinor, row.original.currency),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getInvoiceStatusVariant(row.original.status)}>
            {formatInvoiceStatus(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "issuedAt",
        header: "Issued Date",
        cell: ({ row }) =>
          row.original.issuedAt ? formatDate(row.original.issuedAt) : "—",
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 gap-2"
                disabled={!row.original.pdfUrl}
              >
                <a
                  href={row.original.pdfUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">View PDF</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {row.original.pdfUrl
                ? "Open this invoice PDF in a new tab"
                : "A PDF is not available for this invoice yet"}
            </TooltipContent>
          </Tooltip>
        ),
      },
    ],
    []
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
        error={usageErrorObj}
        onRetry={() => {
          refetchUsage();
          refetchInvoices();
        }}
      />
    );
  }

  const hasActiveSubscription =
    activeSubscription?.status === "active" ||
    activeSubscription?.status === "trialing";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <PageHeader
          title="Billing & Usage"
          description="View your subscription plan, usage, and invoices"
          actions={
            canManageBilling ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setPlanPickerOpen(true)}
                    className="min-h-[44px] gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    {hasActiveSubscription ? "Change plan" : "Subscribe"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {hasActiveSubscription
                    ? "Pick a different plan and start a new checkout"
                    : "Pick a plan and start a secure checkout"}
                </TooltipContent>
              </Tooltip>
            ) : null
          }
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

        {/* Checkout history — super_admin only */}
        {canManageBilling && <CheckoutHistoryTable />}

        {/* Plan picker modal */}
        {canManageBilling && (
          <PlanPickerModal
            open={planPickerOpen}
            onOpenChange={setPlanPickerOpen}
            currentPlanId={activeSubscription?.planId}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
