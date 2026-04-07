"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useSubscriptions, useCancelSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { formatDate } from "@/lib/utils/format-date";
import type { Subscription } from "@/types/billing";
import type { SubscriptionStatus } from "@/types/enums";

function statusVariant(status: SubscriptionStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "trialing":
      return "info" as const;
    case "past_due":
      return "warning" as const;
    case "cancelled":
    case "suspended":
    case "expired":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

interface SubscriptionRowProps {
  subscription: Subscription;
  onCancel: (id: string) => void;
  isLoading: boolean;
}

function SubscriptionActions({
  subscription,
  onCancel,
  isLoading,
}: SubscriptionRowProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
            aria-label="Open menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>Change Plan</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive"
          >
            Cancel
          </DropdownMenuItem>
          <DropdownMenuItem disabled>View Overrides</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancel subscription"
        description={`Are you sure you want to cancel the subscription for ${subscription.tenant_id}? This action cannot be undone.`}
        confirmLabel="Cancel subscription"
        cancelLabel="Keep it"
        variant="destructive"
        isLoading={isLoading}
        onConfirm={() => {
          onCancel(subscription.id);
          setConfirmOpen(false);
        }}
      />
    </>
  );
}

export default function SubscriptionsPage() {
  const { data: response, isLoading, isError, refetch } = useSubscriptions();
  const { mutate: cancelSubscription, isPending } = useCancelSubscription();

  const subscriptions = response?.data ?? [];

  const handleCancel = (subscriptionId: string) => {
    const subscription = subscriptions.find((s) => s.id === subscriptionId);
    if (!subscription) return;

    cancelSubscription(
      {
        tenant_id: subscription.tenant_id,
        reason: "Admin cancellation",
        immediate: true,
      },
      {
        onSuccess: () => {
          toast.success(
            `Subscription for ${subscription.tenant_id} has been cancelled.`
          );
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to cancel subscription"
          );
        },
      }
    );
  };

  const columns: ColumnDef<Subscription>[] = [
    {
      accessorKey: "tenant_id",
      header: "Tenant ID",
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.getValue("tenant_id")}</span>
      ),
    },
    {
      accessorKey: "plan_id",
      header: "Plan ID",
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("plan_id")}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as SubscriptionStatus;
        return (
          <Badge variant={statusVariant(status)}>
            {capitalize(status.replace(/_/g, " "))}
          </Badge>
        );
      },
    },
    {
      accessorKey: "billing_cycle",
      header: "Billing Cycle",
      cell: ({ row }) => {
        const cycle = row.getValue("billing_cycle") as string;
        return <span className="text-sm capitalize">{cycle}</span>;
      },
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => {
        const date = row.getValue("created_at") as number;
        return <span className="text-sm">{formatDate(date)}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <SubscriptionActions
          subscription={row.original}
          onCancel={handleCancel}
          isLoading={isPending}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Manage tenant subscriptions and billing"
      />

      {isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load subscriptions.{" "}
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
          data={subscriptions}
          searchKey="tenant_id"
          searchPlaceholder="Search tenant ID..."
          isLoading={isLoading}
          mobileCard={(subscription) => (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {subscription.tenant_id}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(subscription.created_at)}
                  </p>
                </div>
                <Badge variant={statusVariant(subscription.status)}>
                  {capitalize(subscription.status.replace(/_/g, " "))}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {capitalize(subscription.billing_cycle)} billing
              </div>
              <div className="flex justify-end pt-2">
                <SubscriptionActions
                  subscription={subscription}
                  onCancel={handleCancel}
                  isLoading={isPending}
                />
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
