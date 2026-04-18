"use client";

import { useState } from "react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  Plus,
  MoreHorizontal,
  CreditCard,
  BarChart2,
  AlertTriangle,
  ListChecks,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { BootstrapTenantModal } from "@/features/auth/components/bootstrap-tenant-modal";
import { TenantDetailSheet } from "./tenant-detail-sheet";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { formatDate } from "@/lib/utils/format-date";
import { useActionParam } from "@/hooks/use-action-param";
import {
  useTenantList,
  useOffboardTenant,
} from "@/features/auth/hooks/use-admin-dashboard";
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

  const { data: plans = [], isLoading: plansLoading } = usePlans({ status: "active" });
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
  onViewDetails: (tenant: AdminTenant) => void;
  onSubscribe: (tenant: AdminTenant) => void;
  onOffboard: (tenant: AdminTenant) => void;
}

function TenantActions({ tenant, onViewDetails, onSubscribe, onOffboard }: TenantActionsProps) {
  const { navigate } = useNavigationLoading();

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
        <DropdownMenuItem onClick={() => onViewDetails(tenant)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            navigate(`/admin/subscriptions?tenantId=${tenant.id}`)
          }
        >
          <ListChecks className="mr-2 h-4 w-4" />
          View Subscriptions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSubscribe(tenant)}>
          <CreditCard className="mr-2 h-4 w-4" />
          Subscribe to Plan
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            navigate(`/admin/subscriptions?tenantId=${tenant.id}&tab=usage`)
          }
        >
          <BarChart2 className="mr-2 h-4 w-4" />
          View Usage
        </DropdownMenuItem>
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

export function TenantsPageClient() {
  const { data, isLoading } = useTenantList();
  const tenants = data || [];

  const [bootstrapModalOpen, setBootstrapModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AdminTenant | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<AdminTenant | null>(null);
  const [offboardTarget, setOffboardTarget] = useState<AdminTenant | null>(null);

  const offboardTenant = useOffboardTenant();

  useActionParam({
    create: () => setBootstrapModalOpen(true),
  });

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
          onViewDetails={setDetailTarget}
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
          onViewDetails={setDetailTarget}
          onSubscribe={setSubscribeTarget}
          onOffboard={setOffboardTarget}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <BootstrapTenantModal
        open={bootstrapModalOpen}
        onOpenChange={setBootstrapModalOpen}
      />

      <TenantDetailSheet
        tenant={detailTarget}
        open={!!detailTarget}
        onOpenChange={(open) => { if (!open) setDetailTarget(null); }}
      />

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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full md:w-auto min-h-[44px]"
                onClick={() => setBootstrapModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Bootstrap Tenant
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create a new tenant and their first super admin account</TooltipContent>
          </Tooltip>
        }
      />

      <DataTable
        columns={columns}
        data={tenants}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="companyName"
        searchPlaceholder="Search tenants…"
        emptyTitle="No tenants yet"
        emptyDescription="Bootstrap your first tenant to get started."
        mobileCard={mobileCard}
      />
    </div>
  );
}
