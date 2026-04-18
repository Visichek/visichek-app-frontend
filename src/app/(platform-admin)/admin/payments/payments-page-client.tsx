"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useAllInvoices } from "@/features/invoices/hooks/use-invoices";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format-currency";
import type { Invoice } from "@/types/billing";
import type { InvoiceStatus } from "@/types/enums";

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
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

interface InvoiceRowProps {
  invoice: Invoice;
}

function InvoiceActions({ invoice }: InvoiceRowProps) {
  const handleViewDetails = () => {
    console.log("View invoice details:", invoice.id);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10 min-h-[44px]"
      onClick={handleViewDetails}
    >
      View Details
    </Button>
  );
}

export function PaymentsPageClient() {
  const { data: response, isLoading, isError, refetch } = useAllInvoices();

  const invoices = response?.data ?? [];

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice ID",
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.getValue("invoiceNumber")}</span>
      ),
    },
    {
      accessorKey: "tenantId",
      header: "Tenant ID",
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("tenantId")}</span>
      ),
    },
    {
      accessorKey: "totalMinor",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.getValue("totalMinor") as number;
        const currency = row.original.currency || "NGN";
        return (
          <span className="text-sm font-medium">
            {formatCurrency(amount, currency)}
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
      accessorKey: "issuedAt",
      header: "Issued Date",
      cell: ({ row }) => {
        const date = row.getValue("issuedAt") as number | undefined;
        return (
          <span className="text-sm">
            {date ? formatDate(date) : "—"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <InvoiceActions invoice={row.original} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="View payment transactions and invoices"
      />

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
          searchPlaceholder="Search invoice ID or tenant..."
          isLoading={isLoading}
          mobileCard={(invoice) => (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {invoice.tenantId}
                  </p>
                </div>
                <Badge variant={statusVariant(invoice.status)}>
                  {capitalize(invoice.status.replace(/_/g, " "))}
                </Badge>
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(invoice.totalMinor, invoice.currency || "NGN")}
              </div>
              <div className="text-xs text-muted-foreground">
                {invoice.issuedAt
                  ? `Issued ${formatDate(invoice.issuedAt)}`
                  : "Not yet issued"}
              </div>
              <div className="flex justify-end pt-2">
                <InvoiceActions invoice={invoice} />
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
