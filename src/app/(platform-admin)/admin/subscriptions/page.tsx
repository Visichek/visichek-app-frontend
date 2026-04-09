"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useSubscriptions,
  useCancelSubscription,
  useCreateSubscription,
} from "@/features/subscriptions/hooks/use-subscriptions";
import { useTenantList } from "@/features/auth/hooks/use-admin-dashboard";
import { usePlans } from "@/features/plans/hooks/use-plans";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { formatDate } from "@/lib/utils/format-date";
import { useActionParam } from "@/hooks/use-action-param";
import type { Subscription } from "@/types/billing";
import type { BillingCycle, SubscriptionStatus } from "@/types/enums";

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
        description={`Are you sure you want to cancel the subscription for ${subscription.tenant?.companyName ?? subscription.tenantId}? This action cannot be undone.`}
        confirmLabel="Cancel subscription"
        cancelLabel="Keep it"
        variant="destructive"
        isLoading={isLoading}
        onConfirm={() => {
          onCancel(subscription.Id);
          setConfirmOpen(false);
        }}
      />
    </>
  );
}

// ── Create Subscription Modal ────────────────────────────────────────────────

interface CreateSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateSubscriptionModal({ open, onOpenChange }: CreateSubscriptionModalProps) {
  const [tenantId, setTenantId] = React.useState("");
  const [planId, setPlanId] = React.useState("");
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly");

  const { data: tenants = [], isLoading: tenantsLoading } = useTenantList();
  const { data: plans = [], isLoading: plansLoading } = usePlans({ status: "active" });
  const createSubscription = useCreateSubscription();

  // Reset form when the dialog closes.
  React.useEffect(() => {
    if (!open) {
      setTenantId("");
      setPlanId("");
      setBillingCycle("monthly");
    }
  }, [open]);

  function handleSubmit() {
    if (!tenantId || !planId) return;

    const tenant = tenants.find((t) => t.Id === tenantId);
    toast.promise(
      createSubscription.mutateAsync({ tenantId, planId, billingCycle }),
      {
        loading: "Creating subscription…",
        success: () =>
          `${tenant?.companyName ?? "Tenant"} subscribed successfully.`,
        error: (err: Error) => err.message || "Failed to create subscription.",
      }
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Subscription</DialogTitle>
          <DialogDescription>
            Subscribe a tenant to a plan. The subscription is billed on the
            cycle you select below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tenant-select">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId} disabled={tenantsLoading}>
              <SelectTrigger id="tenant-select" className="min-h-[44px]">
                <SelectValue
                  placeholder={tenantsLoading ? "Loading tenants…" : "Select a tenant"}
                />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.Id} value={tenant.Id}>
                    {tenant.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-select">Plan</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={plansLoading}>
              <SelectTrigger id="plan-select" className="min-h-[44px]">
                <SelectValue
                  placeholder={plansLoading ? "Loading plans…" : "Select a plan"}
                />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.Id} value={plan.Id}>
                    {plan.displayName || plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycle-select">Billing Cycle</Label>
            <Select
              value={billingCycle}
              onValueChange={(v) => setBillingCycle(v as BillingCycle)}
            >
              <SelectTrigger id="cycle-select" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!tenantId || !planId || createSubscription.isPending}
            className="min-h-[44px]"
          >
            {createSubscription.isPending ? "Creating…" : "Create Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SubscriptionsPage() {
  const { data, isLoading, isError, refetch } = useSubscriptions();
  const { mutate: cancelSubscription, isPending } = useCancelSubscription();
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  // Open create modal when navigated from a "Quick Action" card.
  useActionParam({
    create: () => setCreateModalOpen(true),
  });

  const subscriptions = data ?? [];

  const handleCancel = (subscriptionId: string) => {
    const subscription = subscriptions.find((s) => s.Id === subscriptionId);
    if (!subscription) return;

    cancelSubscription(
      {
        tenantId: subscription.tenantId,
        reason: "Admin cancellation",
        immediate: true,
      },
      {
        onSuccess: () => {
          toast.success(
            `Subscription for ${subscription.tenantId} has been cancelled.`
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
      id: "tenant",
      header: "Tenant",
      cell: ({ row }) => {
        const sub = row.original;
        return (
          <div>
            <p className="text-sm font-medium">
              {sub.tenant?.companyName ?? sub.tenantId}
            </p>
            {sub.tenant && (
              <p className="text-xs text-muted-foreground">{sub.tenantId}</p>
            )}
          </div>
        );
      },
    },
    {
      id: "plan",
      header: "Plan",
      cell: ({ row }) => {
        const sub = row.original;
        return (
          <div>
            <p className="text-sm">{sub.plan?.displayName ?? sub.planId}</p>
            {sub.plan && (
              <p className="text-xs text-muted-foreground capitalize">
                {sub.plan.tier}
              </p>
            )}
          </div>
        );
      },
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
      id: "price",
      header: "Price",
      cell: ({ row }) => {
        const sub = row.original;
        if (sub.effectivePrice == null) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {sub.currency} {sub.effectivePrice.toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: "billingCycle",
      header: "Billing",
      cell: ({ row }) => {
        const cycle = row.getValue("billingCycle") as string;
        return <span className="text-sm capitalize">{cycle}</span>;
      },
    },
    {
      id: "periodEnd",
      header: "Period Ends",
      cell: ({ row }) => {
        const sub = row.original;
        if (!sub.currentPeriodEnd) return <span className="text-sm text-muted-foreground">—</span>;
        return <span className="text-sm">{formatDate(sub.currentPeriodEnd)}</span>;
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
      <CreateSubscriptionModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      <PageHeader
        title="Subscriptions"
        description="Manage tenant subscriptions and billing"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full md:w-auto min-h-[44px]"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New Subscription
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Subscribe a tenant to a plan with a billing cycle of your choice
            </TooltipContent>
          </Tooltip>
        }
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
          searchKey="tenantId"
          searchPlaceholder="Search by tenant ID..."
          isLoading={isLoading}
          mobileCard={(subscription) => (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {subscription.tenant?.companyName ?? subscription.tenantId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {subscription.plan?.displayName ?? subscription.planId}
                  </p>
                </div>
                <Badge variant={statusVariant(subscription.status)}>
                  {capitalize(subscription.status.replace(/_/g, " "))}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{capitalize(subscription.billingCycle)} billing</span>
                {subscription.effectivePrice != null && (
                  <span>
                    {subscription.currency} {subscription.effectivePrice.toLocaleString()}
                  </span>
                )}
              </div>
              {subscription.currentPeriodEnd && (
                <div className="text-xs text-muted-foreground">
                  Period ends {formatDate(subscription.currentPeriodEnd)}
                </div>
              )}
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
