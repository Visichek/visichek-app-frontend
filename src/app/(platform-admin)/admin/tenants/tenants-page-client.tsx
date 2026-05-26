"use client";

import { useEffect, useMemo, useState } from "react";
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
import { NavButton } from "@/components/recipes/nav-button";
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
type BoolFilter = "all" | "true" | "false";
type LawfulBasisFilter = "all" | "consent" | "legitimate_interest";

const TENANT_TABS: { value: TenantStatusTab; label: string; description: string }[] = [
  { value: "active", label: "Active", description: "Tenants currently provisioned and serving traffic" },
  { value: "inactive", label: "Inactive", description: "Tenants that have been offboarded or deactivated" },
  { value: "all", label: "All", description: "Show every tenant regardless of status" },
];

const TENANTS_PAGE_SIZE = 25;

export function TenantsPageClient() {
  const { loadingHref } = useNavigationLoading();

  const [statusTab, setStatusTab] = useState<TenantStatusTab>("active");
  const [onboardingFilter, setOnboardingFilter] = useState<BoolFilter>("all");
  const [dpaFilter, setDpaFilter] = useState<BoolFilter>("all");
  const [crossBorderFilter, setCrossBorderFilter] = useState<BoolFilter>("all");
  const [lawfulBasisFilter, setLawfulBasisFilter] = useState<LawfulBasisFilter>("all");
  const [pageIndex, setPageIndex] = useState(0);

  const hasActiveFilters =
    onboardingFilter !== "all" ||
    dpaFilter !== "all" ||
    crossBorderFilter !== "all" ||
    lawfulBasisFilter !== "all";

  // Whenever the user changes any filter, reset to page 0 — otherwise the
  // table can land on a page that no longer exists in the filtered slice.
  useEffect(() => {
    setPageIndex(0);
  }, [statusTab, onboardingFilter, dpaFilter, crossBorderFilter, lawfulBasisFilter]);

  // Server-side filter set per tables.txt §1.1. The status tab maps to the
  // `status` filter; the dropdowns map to the compliance/onboarding flags
  // (onboardingInfoConfirmed, dpaAccepted, crossBorderApproved, lawfulBasis).
  // `facets=status` asks the backend to compute per-tab counts against the
  // full dataset so the badges don't drift as the user paginates.
  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * TENANTS_PAGE_SIZE,
      limit: TENANTS_PAGE_SIZE,
      sort: "-dateCreated",
      facets: "status",
      status: statusTab,
    };
    if (onboardingFilter !== "all") params.onboardingInfoConfirmed = onboardingFilter;
    if (dpaFilter !== "all") params.dpaAccepted = dpaFilter;
    if (crossBorderFilter !== "all") params.crossBorderApproved = crossBorderFilter;
    if (lawfulBasisFilter !== "all") params.lawfulBasis = lawfulBasisFilter;
    return params;
  }, [pageIndex, statusTab, onboardingFilter, dpaFilter, crossBorderFilter, lawfulBasisFilter]);

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
      id: "onboarding",
      header: "Onboarding",
      cell: ({ row }) => {
        const confirmed = row.original.onboardingInfoConfirmed === true;
        const at = row.original.onboardingInfoConfirmedAt;
        return (
          <div className="space-y-0.5">
            {confirmed ? (
              <Badge variant="success">Confirmed</Badge>
            ) : (
              <Badge variant="warning">Pending</Badge>
            )}
            {confirmed && at ? (
              <span className="block text-xs text-muted-foreground">{formatDate(at)}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "dpa",
      header: "DPA",
      cell: ({ row }) => {
        const accepted = row.original.dpaAccepted === true;
        const version = row.original.dpaVersion;
        return accepted ? (
          <div className="space-y-0.5">
            <Badge variant="success">Accepted</Badge>
            {version ? (
              <span className="block text-xs text-muted-foreground">v{version}</span>
            ) : null}
          </div>
        ) : (
          <Badge variant="secondary">Not accepted</Badge>
        );
      },
    },
    {
      id: "lawfulBasis",
      header: "Lawful basis",
      cell: ({ row }) => {
        const basis = row.original.lawfulBasis;
        if (!basis) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <span className="text-sm capitalize">{basis.replace(/_/g, " ")}</span>
        );
      },
    },
    {
      id: "crossBorder",
      header: "Cross-border",
      cell: ({ row }) => (
        row.original.crossBorderApproved
          ? <Badge variant="success">Approved</Badge>
          : <Badge variant="secondary">No</Badge>
      ),
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
    const onboarded = tenant.onboardingInfoConfirmed === true;
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
        <div className="flex flex-wrap items-center gap-2">
          {onboarded ? (
            <Badge variant="success">Onboarded</Badge>
          ) : (
            <Badge variant="warning">Onboarding pending</Badge>
          )}
          {tenant.dpaAccepted === true ? (
            <Badge variant="success">DPA accepted</Badge>
          ) : (
            <Badge variant="secondary">DPA pending</Badge>
          )}
          {tenant.crossBorderApproved ? (
            <Badge variant="success">Cross-border approved</Badge>
          ) : null}
        </div>
        {tenant.lawfulBasis ? (
          <div className="text-xs text-muted-foreground capitalize">
            Lawful basis: {tenant.lawfulBasis.replace(/_/g, " ")}
          </div>
        ) : null}
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
                <NavButton
                  href={ONBOARDING_QUEUE_HREF}
                  variant="outline"
                  className="w-full md:w-auto min-h-[44px]"
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
                </NavButton>
              </TooltipTrigger>
              <TooltipContent>
                Review self-service signups submitted from the marketing site
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton href={NEW_TENANT_HREF} className="w-full md:w-auto min-h-[44px]">
                  {isNavigatingToNew ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Bootstrap Tenant
                </NavButton>
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
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-[44px]"
              title={tab.description}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
                {tabCounts[tab.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:flex-wrap">
        {[
          {
            id: "tenant-onboarding-filter",
            label: "Onboarding",
            tooltip: "Filter by whether the tenant has confirmed their onboarding info",
            value: onboardingFilter,
            onChange: (v: string) => setOnboardingFilter(v as BoolFilter),
            options: [
              { value: "all", label: "All" },
              { value: "true", label: "Confirmed" },
              { value: "false", label: "Pending" },
            ],
          },
          {
            id: "tenant-dpa-filter",
            label: "DPA",
            tooltip: "Filter by whether the tenant accepted the Data Processing Agreement",
            value: dpaFilter,
            onChange: (v: string) => setDpaFilter(v as BoolFilter),
            options: [
              { value: "all", label: "All" },
              { value: "true", label: "Accepted" },
              { value: "false", label: "Not accepted" },
            ],
          },
          {
            id: "tenant-crossborder-filter",
            label: "Cross-border",
            tooltip: "Filter by whether cross-border data transfer is approved",
            value: crossBorderFilter,
            onChange: (v: string) => setCrossBorderFilter(v as BoolFilter),
            options: [
              { value: "all", label: "All" },
              { value: "true", label: "Approved" },
              { value: "false", label: "Not approved" },
            ],
          },
          {
            id: "tenant-lawfulbasis-filter",
            label: "Lawful basis",
            tooltip: "Filter by the tenant's declared lawful basis for processing visitor data",
            value: lawfulBasisFilter,
            onChange: (v: string) => setLawfulBasisFilter(v as LawfulBasisFilter),
            options: [
              { value: "all", label: "All" },
              { value: "consent", label: "Consent" },
              { value: "legitimate_interest", label: "Legitimate interest" },
            ],
          },
        ].map((f) => (
          <div key={f.id} className="flex flex-1 flex-col gap-1 md:max-w-[200px]">
            <Label htmlFor={f.id} className="text-xs text-muted-foreground">
              {f.label}
            </Label>
            <Select value={f.value} onValueChange={f.onChange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger id={f.id} className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">{f.tooltip}</TooltipContent>
              </Tooltip>
              <SelectContent>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {hasActiveFilters && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="md:self-end min-h-[44px]"
                onClick={() => {
                  setOnboardingFilter("all");
                  setDpaFilter("all");
                  setCrossBorderFilter("all");
                  setLawfulBasisFilter("all");
                }}
              >
                Reset filters
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Clear all onboarding and compliance filters
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div data-tutorial-anchor="tenants-table">
      <DataTable
        columns={columns}
        data={tenants}
        isLoading={isLoading}
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: TENANTS_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
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
          hasActiveFilters
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
        getRowHref={(tenant) => tenantDetailHref(tenant.id)}
        rowClickAriaLabel={(tenant) => `View details for ${tenant.companyName}`}
      />
      </div>

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
