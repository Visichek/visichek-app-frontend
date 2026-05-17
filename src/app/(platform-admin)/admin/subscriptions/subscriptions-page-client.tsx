"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useSubscriptions,
  useCancelSubscription,
  useCreateSubscription,
} from "@/features/subscriptions/hooks/use-subscriptions";
import { useTenant, useTenantList } from "@/features/auth/hooks/use-admin-dashboard";
import { usePlan, usePlans } from "@/features/plans/hooks/use-plans";
import { TenantUsagePanel } from "@/features/usage/components/tenant-usage-panel";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { NavButton } from "@/components/recipes/nav-button";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format-date";
import { useActionParam } from "@/hooks/use-action-param";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import type { Subscription } from "@/types/billing";
import type { BillingCycle, SubscriptionStatus } from "@/types/enums";

type SubscriptionStatusTab =
  | "all"
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "suspended"
  | "expired";

const SUBSCRIPTION_STATUS_TABS: {
  value: SubscriptionStatusTab;
  label: string;
  description: string;
}[] = [
  { value: "all", label: "All", description: "Show every subscription regardless of status" },
  { value: "active", label: "Active", description: "Subscriptions currently being billed and serving paid features" },
  { value: "trialing", label: "Trialing", description: "Subscriptions inside their trial window before the first charge" },
  { value: "past_due", label: "Past due", description: "Subscriptions whose latest invoice failed and is awaiting retry" },
  { value: "cancelled", label: "Cancelled", description: "Subscriptions that were cancelled by an admin or the tenant" },
  { value: "suspended", label: "Suspended", description: "Subscriptions paused administratively but not cancelled" },
  { value: "expired", label: "Expired", description: "Subscriptions that ran past their period without renewal" },
];

const SUBSCRIPTION_PAGE_SIZE = 25;

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

/**
 * The subscriptions list endpoint returns bare `tenantId` / `planId` strings
 * with no embedded summaries, so each row hydrates its own tenant and plan
 * lookups. React Query dedupes by key, so multiple subscriptions for the
 * same tenant or plan share a single fetch.
 */
function TenantNameCell({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useTenant(tenantId);

  if (isLoading) {
    return (
      <div className="space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium">
        {data?.companyName ?? <span className="font-mono text-xs">{tenantId}</span>}
      </p>
      <p className="font-mono text-xs text-muted-foreground">{tenantId}</p>
    </div>
  );
}

function PlanNameCell({ planId }: { planId: string }) {
  const { data, isLoading } = usePlan(planId);

  if (isLoading) {
    return (
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm">
        {data?.displayName || data?.name || (
          <span className="font-mono text-xs">{planId}</span>
        )}
      </p>
      {data?.tier && (
        <p className="text-xs capitalize text-muted-foreground">{data.tier}</p>
      )}
    </div>
  );
}


interface SubscriptionRowProps {
  subscription: Subscription;
  onCancel: (id: string, reason: string, immediate: boolean) => void;
  isLoading: boolean;
}

function SubscriptionActions({
  subscription,
  onCancel,
  isLoading,
}: SubscriptionRowProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"immediate" | "period_end">(
    "period_end",
  );
  const [reason, setReason] = React.useState("Admin cancellation");

  React.useEffect(() => {
    if (!confirmOpen) {
      // Reset on close so the next open starts fresh.
      setMode("period_end");
      setReason("Admin cancellation");
    }
  }, [confirmOpen]);

  const { data: tenant } = useTenant(subscription.tenantId);
  const tenantLabel = tenant?.companyName ?? subscription.tenantId;
  const periodEnd = subscription.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : null;

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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel subscription</DialogTitle>
            <DialogDescription>
              Choose how {tenantLabel} should be cancelled. Cancellation always
              ends with the tenant on the FREE plan — paid subscriptions don&apos;t
              leave tenants with no active plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => setMode("period_end")}
              aria-pressed={mode === "period_end"}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                mode === "period_end"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                  : "hover:border-foreground/30",
              )}
            >
              <p className="text-sm font-medium">End of current period</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Subscription stays active and paid features keep working
                {periodEnd ? ` until ${periodEnd}` : ""}.
                The tenant is then automatically moved to the FREE plan and
                non-HQ branches are deactivated.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("immediate")}
              aria-pressed={mode === "immediate"}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                mode === "immediate"
                  ? "border-destructive bg-destructive/5 ring-2 ring-destructive/40"
                  : "hover:border-foreground/30",
              )}
            >
              <p className="text-sm font-medium text-destructive">
                Immediate
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Drops the tenant to FREE right now. Paid features stop working
                immediately and non-HQ branches are deactivated. Visitor logs
                and configs are preserved.
              </p>
            </button>

            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason (visible in audit log)</Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Admin cancellation per tenant request"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="min-h-[44px]"
              disabled={isLoading}
            >
              Keep subscription
            </Button>
            <Button
              variant={mode === "immediate" ? "destructive" : "default"}
              onClick={() => {
                onCancel(subscription.id, reason.trim(), mode === "immediate");
                setConfirmOpen(false);
              }}
              disabled={isLoading || reason.trim().length === 0}
              className="min-h-[44px]"
            >
              {mode === "immediate"
                ? "Cancel and drop to FREE now"
                : "Cancel at period end"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Header rendered above the subscriptions list (or usage view) when the
 * page is scoped to a single tenant via `?tenantId=...`. Lets admins jump
 * back to the tenants list and shows the resolved company name.
 */
function ScopedTenantHeader({ tenantId }: { tenantId: string }) {
  const { data: tenant, isLoading } = useTenant(tenantId);
  const { loadingHref, navigateFromOverlay } = useNavigationLoading();
  const tenantsHref = "/admin/tenants";
  const tenantHref = `/admin/tenants/${tenantId}`;
  const isNavigatingTenants = loadingHref === tenantsHref;
  const isNavigatingTenant = loadingHref === tenantHref;

  return (
    <div className="space-y-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <NavButton
            href={tenantsHref}
            variant="ghost"
            size="sm"
            className="-ml-2 min-h-[44px]"
          >
            {isNavigatingTenants ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Back to tenants
          </NavButton>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Return to the tenants list
        </TooltipContent>
      </Tooltip>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {isLoading ? (
          <Skeleton className="h-5 w-48" />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={tenantHref}
                onClick={(event) => {
                  // Preserve cmd/ctrl/shift/middle-click default of opening
                  // in a new tab; only intercept plain left-click so we can
                  // defer the in-app navigation past the tooltip portal
                  // unmount (otherwise the page-tree swap races the close
                  // and crashes the React 19 reconciler).
                  if (
                    event.defaultPrevented ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  navigateFromOverlay(tenantHref);
                }}
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                {isNavigatingTenant ? (
                  <Loader2
                    className="mr-1 inline h-3 w-3 animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                {tenant?.companyName ?? tenantId}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open this tenant&apos;s overview page
            </TooltipContent>
          </Tooltip>
        )}
        <span className="font-mono text-xs text-muted-foreground break-all">
          {tenantId}
        </span>
      </div>
    </div>
  );
}

/**
 * Usage view rendered when the page URL includes `?tab=usage&tenantId=...`.
 * The tenant detail page links here for the "Usage" CTA.
 */
function UsageView({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage"
        description="Plan caps, monthly counters, and storage usage for this tenant"
      />
      <TenantUsagePanel tenantId={tenantId} />
    </div>
  );
}

interface CreateSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateSubscriptionModal({ open, onOpenChange }: CreateSubscriptionModalProps) {
  const [tenantId, setTenantId] = React.useState("");
  const [planId, setPlanId] = React.useState("");
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly");

  const { data: tenantList, isLoading: tenantsLoading } = useTenantList({ limit: 200, sort: "companyName" });
  const tenants = tenantList?.items ?? [];
  const { data: plansList, isLoading: plansLoading } = usePlans({ status: "active", limit: 100 });
  const plans = plansList?.items ?? [];
  const createSubscription = useCreateSubscription();

  React.useEffect(() => {
    if (!open) {
      setTenantId("");
      setPlanId("");
      setBillingCycle("monthly");
    }
  }, [open]);

  function handleSubmit() {
    if (!tenantId || !planId) return;

    const tenant = tenants.find((t) => t.id === tenantId);
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
                  <SelectItem key={tenant.id} value={tenant.id}>
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
                  <SelectItem key={plan.id} value={plan.id}>
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

export function SubscriptionsPageClient() {
  const searchParams = useSearchParams();
  const tenantIdParam = searchParams.get("tenantId");
  const tabParam = searchParams.get("tab");
  const isUsageView = tabParam === "usage" && !!tenantIdParam;

  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = React.useState<SubscriptionStatusTab>("all");
  const [pageIndex, setPageIndex] = React.useState(0);

  // Reset pagination whenever the user changes the status filter or the
  // scoped tenant — otherwise the table can land on a page that doesn't
  // exist in the new filtered slice.
  React.useEffect(() => {
    setPageIndex(0);
  }, [statusTab, tenantIdParam]);

  const subscriptionsParams = React.useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * SUBSCRIPTION_PAGE_SIZE,
      limit: SUBSCRIPTION_PAGE_SIZE,
      sort: "-dateCreated",
      facets: "status",
    };
    if (tenantIdParam) params.tenantId = tenantIdParam;
    if (statusTab !== "all") params.status = statusTab;
    return params;
  }, [pageIndex, statusTab, tenantIdParam]);

  const { data, isLoading, isError, refetch } = useSubscriptions(subscriptionsParams);
  const { mutate: cancelSubscription, isPending } = useCancelSubscription();
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  const meta = data?.meta;
  const statusFacet = meta?.facets?.status ?? {};
  const tabCounts: Record<SubscriptionStatusTab, number> = {
    all: statusFacet.all ?? meta?.total ?? 0,
    active: statusFacet.active ?? 0,
    trialing: statusFacet.trialing ?? 0,
    past_due: statusFacet.past_due ?? 0,
    cancelled: statusFacet.cancelled ?? 0,
    suspended: statusFacet.suspended ?? 0,
    expired: statusFacet.expired ?? 0,
  };

  useActionParam({
    create: () => setCreateModalOpen(true),
  });

  const subscriptions = data?.items ?? [];

  const handleCancel = (
    subscriptionId: string,
    reason: string,
    immediate: boolean,
  ) => {
    const subscription = subscriptions.find((s) => s.id === subscriptionId);
    if (!subscription) return;

    // Pull the tenant company name from React Query's cache (populated by
    // <TenantNameCell> when it rendered the row). Fall back to the raw ID
    // if the cache hasn't been hydrated yet.
    const cachedTenant = queryClient.getQueryData<{ companyName?: string }>([
      "admin",
      "tenants",
      "detail",
      subscription.tenantId,
    ]);
    const tenantLabel = cachedTenant?.companyName ?? subscription.tenantId;

    cancelSubscription(
      {
        tenantId: subscription.tenantId,
        reason: reason || "Admin cancellation",
        immediate,
      },
      {
        onSuccess: () => {
          toast.success(
            immediate
              ? `${tenantLabel} dropped to FREE.`
              : `${tenantLabel} will be moved to FREE at the end of the billing period.`,
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
      cell: ({ row }) => <TenantNameCell tenantId={row.original.tenantId} />,
    },
    {
      id: "plan",
      header: "Plan",
      cell: ({ row }) => <PlanNameCell planId={row.original.planId} />,
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

      {tenantIdParam && <ScopedTenantHeader tenantId={tenantIdParam} />}

      {isUsageView ? (
        <UsageView tenantId={tenantIdParam!} />
      ) : (
        <PageHeader
          title={tenantIdParam ? "Tenant Subscriptions" : "Subscriptions"}
          description={
            tenantIdParam
              ? "Subscriptions for this tenant"
              : "Manage tenant subscriptions and billing"
          }
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
      )}

      {isUsageView ? null : (
        <Tabs
          value={statusTab}
          onValueChange={(v) => setStatusTab(v as SubscriptionStatusTab)}
        >
          <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
            {SUBSCRIPTION_STATUS_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="min-h-[44px]"
                title={tab.description}
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
                  {tabCounts[tab.value].toLocaleString()}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isUsageView ? null : isError ? (
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
          serverPagination={{
            pageIndex,
            pageSize: SUBSCRIPTION_PAGE_SIZE,
            totalCount: meta?.total ?? null,
            hasMore: meta?.hasMore,
            onPageChange: setPageIndex,
          }}
          mobileCard={(subscription) => (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                  <TenantNameCell tenantId={subscription.tenantId} />
                  <PlanNameCell planId={subscription.planId} />
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
          getRowId={(subscription) => subscription.id}
          getRowHref={(subscription) =>
            subscription.tenantId ? `/admin/tenants/${subscription.tenantId}` : undefined
          }
          rowClickAriaLabel={() => "View the tenant this subscription belongs to"}
        />
      )}
    </div>
  );
}
