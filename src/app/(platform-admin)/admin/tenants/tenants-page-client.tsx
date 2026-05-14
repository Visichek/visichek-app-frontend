"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  Plus,
  MoreHorizontal,
  CreditCard,
  BarChart2,
  AlertTriangle,
  ListChecks,
  Eye,
  Inbox,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable, type DataTableBulkAction } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { formatDate } from "@/lib/utils/format-date";
import { summarizeBulkResult } from "@/lib/api/bulk";
import {
  useTenantList,
  useOffboardTenant,
  useBulkOffboardTenants,
} from "@/features/auth/hooks/use-admin-dashboard";

const NEW_TENANT_HREF = "/admin/tenants/new";
const ONBOARDING_QUEUE_HREF = "/admin/tenants/onboarding";
function tenantDetailHref(tenantId: string) {
  return `/admin/tenants/${tenantId}`;
}
import { useCreateSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { usePlans } from "@/features/plans/hooks/use-plans";
import type { AdminTenant } from "@/types/admin";
import type { BillingCycle } from "@/types/enums";

function subscriptionStatusVariant(status: string) {
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

interface SubscribeModalProps {
  tenant: AdminTenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SubscribeModal({ tenant, open, onOpenChange }: SubscribeModalProps) {
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const { data: plansList, isLoading: plansLoading } = usePlans({ status: "active", limit: 100 });
  const plans = plansList?.items ?? [];
  const createSubscription = useCreateSubscription();

  function handleSubmit() {
    if (!tenant || !planId) return;

    toast.promise(
      createSubscription.mutateAsync({
        tenantId: tenant.id,
        planId,
        billingCycle,
      }),
      {
        loading: "Creating subscription…",
        success: () => {
          onOpenChange(false);
          setPlanId("");
          setBillingCycle("monthly");
          return `${tenant.companyName} subscribed successfully.`;
        },
        error: (err: Error) => err.message || "Failed to create subscription.",
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to Plan</DialogTitle>
          <DialogDescription>
            Assign a billing plan to{" "}
            <span className="font-medium">{tenant?.companyName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="plan-select">Plan</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={plansLoading}>
              <SelectTrigger id="plan-select" className="min-h-[44px]">
                <SelectValue placeholder={plansLoading ? "Loading plans…" : "Select a plan"} />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!planId || createSubscription.isPending}
            className="min-h-[44px]"
          >
            {createSubscription.isPending ? "Subscribing…" : "Subscribe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TenantActionsProps {
  tenant: AdminTenant;
  onSubscribe: (tenant: AdminTenant) => void;
  onOffboard: (tenant: AdminTenant) => void;
}

function TenantActions({ tenant, onSubscribe, onOffboard }: TenantActionsProps) {
  const detailHref = tenantDetailHref(tenant.id);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Tenant actions">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open actions menu</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Open actions for {tenant.companyName}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuNavItem
          href={detailHref}
          label="View Details"
          icon={<Eye className="h-4 w-4" aria-hidden="true" />}
        />
        <DropdownMenuSeparator />
        <DropdownMenuNavItem
          href={`/admin/subscriptions?tenantId=${tenant.id}`}
          label="View Subscriptions"
          icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
        />
        <DropdownMenuItem onClick={() => onSubscribe(tenant)}>
          <CreditCard className="mr-2 h-4 w-4" />
          Subscribe to Plan
        </DropdownMenuItem>
        <DropdownMenuNavItem
          href={`/admin/subscriptions?tenantId=${tenant.id}&tab=usage`}
          label="View Usage"
          icon={<BarChart2 className="h-4 w-4" aria-hidden="true" />}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onOffboard(tenant)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Offboard Tenant
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TenantStatusTab = "active" | "inactive" | "all";
type SubscriptionStatusFilter = "all" | "active" | "trialing" | "past_due" | "cancelled" | "suspended" | "expired" | "none";

const TENANT_TABS: { value: TenantStatusTab; label: string; description: string }[] = [
  { value: "active", label: "Active", description: "Tenants currently provisioned and serving traffic" },
  { value: "inactive", label: "Inactive", description: "Tenants that have been offboarded or deactivated" },
  { value: "all", label: "All", description: "Show every tenant regardless of status" },
];

const TENANT_PLAN_TIERS = [
  "free",
  "starter",
  "professional",
  "enterprise",
  "custom",
] as const;

export function TenantsPageClient() {
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [statusTab, setStatusTab] = useState<TenantStatusTab>("active");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [subscriptionFilter, setSubscriptionFilter] =
    useState<SubscriptionStatusFilter>("all");

  // Server-side filter set per tables.txt §1.1. The status tab maps to the
  // `status` filter; the dropdowns map to `planTier` and `subscriptionStatus`.
  // `facets=status` asks the backend to compute per-tab counts against the
  // full dataset so the badges don't drift as the user paginates.
  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      limit: 50,
      sort: "-dateCreated",
      facets: "status",
      status: statusTab,
    };
    if (planFilter !== "all") params.planTier = planFilter;
    if (subscriptionFilter !== "all") params.subscriptionStatus = subscriptionFilter;
    return params;
  }, [statusTab, planFilter, subscriptionFilter]);

  const { data, isLoading } = useTenantList(listFilters);
  const tenants = useMemo(() => data?.items ?? [], [data]);
  const meta = data?.meta;

  const tabCounts = useMemo(() => {
    const facet = meta?.facets?.status ?? {};
    return {
      active: facet.active ?? 0,
      inactive: facet.inactive ?? 0,
      all: facet.all ?? meta?.total ?? 0,
    };
  }, [meta]);

  const [subscribeTarget, setSubscribeTarget] = useState<AdminTenant | null>(null);
  const [offboardTarget, setOffboardTarget] = useState<AdminTenant | null>(null);
  const [bulkOffboardIds, setBulkOffboardIds] = useState<string[] | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const offboardTenant = useOffboardTenant();
  const bulkOffboard = useBulkOffboardTenants();

  async function handleBulkOffboardConfirm() {
    if (!bulkOffboardIds || bulkOffboardIds.length === 0) return;
    setBulkPending(true);
    try {
      const result = await bulkOffboard.mutateAsync({ ids: bulkOffboardIds });
      const { tone, message } = summarizeBulkResult(result, "tenant", "offboarding started");
      toast[tone](message);
      setBulkOffboardIds(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Bulk offboard failed"
      );
    } finally {
      setBulkPending(false);
    }
  }

  const bulkActions: DataTableBulkAction<AdminTenant>[] = [
    {
      label: "Offboard",
      description: "Start offboarding for every selected tenant — schedules data deletion and terminates active sessions",
      icon: <AlertTriangle className="h-4 w-4" />,
      variant: "destructive",
      onClick: (ids) => {
        if (ids.length === 0) return;
        setBulkOffboardIds(ids);
      },
    },
  ];

  function handleOffboardConfirm() {
    if (!offboardTarget) return;
    toast.promise(
      offboardTenant.mutateAsync(offboardTarget.id),
      {
        loading: "Starting offboarding…",
        success: () => {
          setOffboardTarget(null);
          return `${offboardTarget.companyName} offboarding started.`;
        },
        error: (err: Error) => err.message || "Offboarding failed.",
      }
    );
  }

  const columns: ColumnDef<AdminTenant>[] = [
    {
      accessorKey: "companyName",
      header: "Company",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.companyName}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        row.original.isActive
          ? <Badge variant="success">Active</Badge>
          : <Badge variant="secondary">Inactive</Badge>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      cell: ({ row }) => {
        const plan = row.original.planSummary;
        if (!plan) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <div className="space-y-0.5">
            <span className="text-sm font-medium">{plan.planDisplayName || plan.planName}</span>
            <span className="block text-xs text-muted-foreground capitalize">{plan.planTier}</span>
          </div>
        );
      },
    },
    {
      id: "subscriptionStatus",
      header: "Subscription",
      cell: ({ row }) => {
        const status = row.original.planSummary?.subscriptionStatus;
        if (!status) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Badge variant={subscriptionStatusVariant(status)}>
            {status.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "dateCreated",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.dateCreated ? formatDate(row.original.dateCreated) : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <TenantActions
          tenant={row.original}
          onSubscribe={setSubscribeTarget}
          onOffboard={setOffboardTarget}
        />
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (tenant: AdminTenant) => {
    const plan = tenant.planSummary;
    return (
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{tenant.companyName}</span>
          {tenant.isActive
            ? <Badge variant="success">Active</Badge>
            : <Badge variant="secondary">Inactive</Badge>}
        </div>
        <div className="text-sm text-muted-foreground">
          {tenant.dateCreated ? formatDate(tenant.dateCreated) : "—"}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm">{plan ? (plan.planDisplayName || plan.planName) : "—"}</span>
            {plan && (
              <span className="ml-1.5 text-xs text-muted-foreground capitalize">{plan.planTier}</span>
            )}
          </div>
          {plan?.subscriptionStatus ? (
            <Badge variant={subscriptionStatusVariant(plan.subscriptionStatus)}>
              {plan.subscriptionStatus.replace(/_/g, " ")}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No subscription</span>
          )}
        </div>
        <TenantActions
          tenant={tenant}
          onSubscribe={setSubscribeTarget}
          onOffboard={setOffboardTarget}
        />
      </div>
    );
  };

  const isNavigatingToNew = loadingHref === NEW_TENANT_HREF;
  const isNavigatingToQueue = loadingHref === ONBOARDING_QUEUE_HREF;

  return (
    <div className="space-y-6">
      <SubscribeModal
        tenant={subscribeTarget}
        open={!!subscribeTarget}
        onOpenChange={(open) => { if (!open) setSubscribeTarget(null); }}
      />

      <ConfirmDialog
        open={!!offboardTarget}
        onOpenChange={(open) => { if (!open) setOffboardTarget(null); }}
        title={`Offboard ${offboardTarget?.companyName ?? "tenant"}?`}
        description="This will start the offboarding process. The tenant's data will be scheduled for deletion and all active sessions will be terminated. This action cannot be undone."
        confirmLabel="Offboard"
        variant="destructive"
        isLoading={offboardTenant.isPending}
        onConfirm={handleOffboardConfirm}
      />

      <PageHeader
        title="Tenants"
        description="Manage tenant organizations"
        actions={
          <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:gap-2 md:w-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="outline"
                  className="w-full md:w-auto min-h-[44px]"
                >
                  <Link
                    href={ONBOARDING_QUEUE_HREF}
                    onClick={() => handleNavClick(ONBOARDING_QUEUE_HREF)}
                  >
                    {isNavigatingToQueue ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Inbox className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Onboarding queue
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Review self-service signups submitted from the marketing site
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild className="w-full md:w-auto min-h-[44px]">
                  <Link
                    href={NEW_TENANT_HREF}
                    onClick={() => handleNavClick(NEW_TENANT_HREF)}
                  >
                    {isNavigatingToNew ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Bootstrap Tenant
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Create a new tenant and their first super admin account
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as TenantStatusTab)}
      >
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {TENANT_TABS.map((tab) => (
            <Tooltip key={tab.value}>
              <TooltipTrigger asChild>
                <TabsTrigger value={tab.value} className="min-h-[44px]">
                  {tab.label}
                  <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
                    {tabCounts[tab.value]}
                  </span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tab.description}</TooltipContent>
            </Tooltip>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <div className="flex flex-1 flex-col gap-1 md:max-w-[220px]">
          <Label htmlFor="tenant-plan-filter" className="text-xs text-muted-foreground">
            Plan tier
          </Label>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger id="tenant-plan-filter" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Filter the list to a specific plan tier
              </TooltipContent>
            </Tooltip>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {TENANT_PLAN_TIERS.map((tier) => (
                <SelectItem key={tier} value={tier} className="capitalize">
                  {tier}
                </SelectItem>
              ))}
              <SelectItem value="none">No plan attached</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-col gap-1 md:max-w-[240px]">
          <Label htmlFor="tenant-subscription-filter" className="text-xs text-muted-foreground">
            Subscription status
          </Label>
          <Select
            value={subscriptionFilter}
            onValueChange={(v) =>
              setSubscriptionFilter(v as SubscriptionStatusFilter)
            }
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger id="tenant-subscription-filter" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Filter by the tenant&apos;s current subscription state
              </TooltipContent>
            </Tooltip>
            <SelectContent>
              <SelectItem value="all">All subscriptions</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="past_due">Past due</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="none">No subscription</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(planFilter !== "all" || subscriptionFilter !== "all") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="md:self-end min-h-[44px]"
                onClick={() => {
                  setPlanFilter("all");
                  setSubscriptionFilter("all");
                }}
              >
                Reset filters
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Clear plan and subscription filters
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="companyName"
        searchPlaceholder="Search tenants…"
        emptyTitle={
          statusTab === "inactive"
            ? "No inactive tenants"
            : statusTab === "active"
              ? "No active tenants"
              : "No tenants yet"
        }
        emptyDescription={
          planFilter !== "all" || subscriptionFilter !== "all"
            ? "No tenants match the current filters. Try clearing them."
            : statusTab === "inactive"
              ? "Inactive tenants will appear here after offboarding."
              : "Bootstrap your first tenant to get started."
        }
        mobileCard={mobileCard}
        selectable
        getRowId={(tenant) => tenant.id}
        itemNoun="tenant"
        bulkActions={bulkActions}
      />

      <ConfirmDialog
        open={bulkOffboardIds !== null}
        onOpenChange={(open) => {
          if (!open) setBulkOffboardIds(null);
        }}
        title={`Offboard ${bulkOffboardIds?.length ?? 0} tenant${(bulkOffboardIds?.length ?? 0) === 1 ? "" : "s"}`}
        description={`Start offboarding for ${bulkOffboardIds?.length ?? 0} tenant${(bulkOffboardIds?.length ?? 0) === 1 ? "" : "s"}. Their data will be scheduled for deletion and all active sessions terminated. This cannot be undone.`}
        confirmLabel="Offboard"
        variant="destructive"
        isLoading={bulkPending}
        onConfirm={handleBulkOffboardConfirm}
      />
    </div>
  );
}
