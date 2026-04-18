"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/recipes/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import {
  useCheckoutSessions,
  useCancelCheckoutSession,
} from "@/features/checkout/hooks/use-checkout";
import { ApiError } from "@/types/api";
import type {
  CheckoutSession,
  CheckoutSessionStatus,
} from "@/types/billing";

type FilterValue = "all" | CheckoutSessionStatus;

const FILTERS: { value: FilterValue; label: string; tip: string }[] = [
  { value: "all", label: "All", tip: "Show checkouts in every status" },
  { value: "pending", label: "Pending", tip: "Show checkouts still waiting for payment" },
  { value: "succeeded", label: "Succeeded", tip: "Show completed, paid checkouts" },
  { value: "failed", label: "Failed", tip: "Show checkouts where payment failed" },
  { value: "expired", label: "Expired", tip: "Show checkouts that timed out before payment" },
  { value: "cancelled", label: "Cancelled", tip: "Show checkouts you cancelled before paying" },
];

function statusBadgeVariant(
  status: CheckoutSessionStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "succeeded":
      return "secondary";
    case "pending":
      return "default";
    case "failed":
    case "expired":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "default";
  }
}

function cancelErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "This session can no longer be cancelled.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Couldn't cancel the session.";
}

export function CheckoutHistoryTable() {
  const [filter, setFilter] = useState<FilterValue>("all");

  const { data, isLoading, isError } = useCheckoutSessions(
    filter === "all" ? { limit: 50 } : { status: filter, limit: 50 }
  );

  const cancelMutation = useCancelCheckoutSession();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const sessions = useMemo(() => data ?? [], [data]);

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await cancelMutation.mutateAsync(id);
      toast.success("Checkout cancelled.");
    } catch (err) {
      toast.error(cancelErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  const columns = useMemo<ColumnDef<CheckoutSession>[]>(
    () => [
      {
        accessorKey: "dateCreated",
        header: "Created",
        cell: ({ row }) => formatDate(row.original.dateCreated),
      },
      {
        accessorKey: "amountMinor",
        header: "Amount",
        cell: ({ row }) =>
          formatCurrency(row.original.amountMinor, row.original.currency),
      },
      {
        accessorKey: "billingCycle",
        header: "Cycle",
        cell: ({ row }) => (
          <span className="capitalize">{row.original.billingCycle}</span>
        ),
      },
      {
        accessorKey: "provider",
        header: "Provider",
        cell: ({ row }) => (
          <span className="capitalize">{row.original.provider}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={statusBadgeVariant(row.original.status)}
            className="capitalize"
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const session = row.original;
          const isPending = session.status === "pending";
          const isThisCancelling =
            cancelMutation.isPending && cancellingId === session.id;
          return (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2"
                  >
                    <Link href={`/app/billing/checkout/${session.id}`}>
                      <ExternalLink className="h-4 w-4" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Open this checkout session to view its status and details
                </TooltipContent>
              </Tooltip>

              {isPending && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(session.id)}
                      disabled={isThisCancelling}
                      className="h-8 gap-2 text-destructive hover:text-destructive"
                    >
                      {isThisCancelling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Cancel</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Cancel this pending checkout — no charge will be made
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    // handleCancel and cancellingId are referenced; including the mutation's
    // isPending keeps button disabled state in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancelMutation.isPending, cancellingId]
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg">Checkout history</CardTitle>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <Tooltip key={f.value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setFilter(f.value)}
                      aria-pressed={active}
                      className={cn(
                        "min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{f.tip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Couldn't load checkout history.
            </p>
          ) : (
            <DataTable
              columns={columns}
              data={sessions}
              isLoading={isLoading}
              pagination
              pageSize={10}
              emptyTitle="No checkouts yet"
              emptyDescription="When you start a subscription checkout it will show up here."
            />
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
