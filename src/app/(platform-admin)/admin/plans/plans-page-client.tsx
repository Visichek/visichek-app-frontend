"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Edit2,
  Copy,
  Trash2,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  usePlans,
  useDeletePlan,
  useActivatePlan,
  useArchivePlan,
  useClonePlan,
} from "@/features/plans/hooks/use-plans";
import type { Plan } from "@/types/billing";
import type { PlanStatus, PlanTier } from "@/types/enums";

const NEW_PLAN_HREF = "/admin/plans/new";

function editPlanHref(planId: string) {
  return `/admin/plans/${planId}/edit`;
}

function statusBadgeVariant(status: PlanStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "draft":
      return "secondary" as const;
    case "archived":
      return "outline" as const;
  }
}

function tierBadgeVariant(tier: PlanTier) {
  switch (tier) {
    case "free":
      return "outline" as const;
    case "starter":
      return "info" as const;
    case "professional":
      return "success" as const;
    case "enterprise":
      return "default" as const;
    case "custom":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function PlansPageClient() {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data, isLoading } = usePlans({ skip: 0, limit: 50 });
  const plans = data || [];
  const deleteMutation = useDeletePlan();
  const activateMutation = useActivatePlan();
  const archiveMutation = useArchivePlan();
  const cloneMutation = useClonePlan();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | undefined>();
  const [planToActivate, setPlanToActivate] = useState<Plan | undefined>();
  const [planToArchive, setPlanToArchive] = useState<Plan | undefined>();

  const handleDeleteClick = (plan: Plan) => {
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  const handleActivateClick = (plan: Plan) => {
    setPlanToActivate(plan);
    setActivateDialogOpen(true);
  };

  const handleArchiveClick = (plan: Plan) => {
    setPlanToArchive(plan);
    setArchiveDialogOpen(true);
  };

  const handleCloneClick = async (plan: Plan) => {
    try {
      await cloneMutation.mutateAsync({
        sourcePlanId: plan.id,
        newName: `${plan.name} (Copy)`,
        newDisplayName: `${plan.displayName || plan.name} (Copy)`,
      });
      toast.success("Plan cloned successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clone plan"
      );
    }
  };

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return;
    try {
      await deleteMutation.mutateAsync(planToDelete.id);
      toast.success("Plan deleted successfully");
      setDeleteDialogOpen(false);
      setPlanToDelete(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete plan"
      );
    }
  };

  const handleActivateConfirm = async () => {
    if (!planToActivate) return;
    try {
      await activateMutation.mutateAsync(planToActivate.id);
      toast.success("Plan activated successfully");
      setActivateDialogOpen(false);
      setPlanToActivate(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to activate plan"
      );
    }
  };

  const handleArchiveConfirm = async () => {
    if (!planToArchive) return;
    try {
      await archiveMutation.mutateAsync(planToArchive.id);
      toast.success("Plan archived successfully");
      setArchiveDialogOpen(false);
      setPlanToArchive(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive plan"
      );
    }
  };

  const columns: ColumnDef<Plan>[] = [
    {
      accessorKey: "displayName",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.displayName || row.original.name}
        </span>
      ),
    },
    {
      id: "tier",
      header: "Tier",
      cell: ({ row }) => (
        <Badge variant={tierBadgeVariant(row.original.tier as PlanTier)}>
          {row.original.tier}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.status as PlanStatus)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "price",
      header: "Monthly Price",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.basePriceMonthly != null
            ? `₦${row.original.basePriceMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Plan actions">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>View actions for this plan</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link
                href={editPlanHref(row.original.id)}
                onClick={() => handleNavClick(editPlanHref(row.original.id))}
              >
                {loadingHref === editPlanHref(row.original.id) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Edit2 className="mr-2 h-4 w-4" />
                )}
                Edit
              </Link>
            </DropdownMenuItem>
            {row.original.status !== "active" && (
              <DropdownMenuItem onClick={() => handleActivateClick(row.original)}>
                Activate
              </DropdownMenuItem>
            )}
            {row.original.status === "active" && (
              <DropdownMenuItem onClick={() => handleArchiveClick(row.original)}>
                Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleCloneClick(row.original)}>
              <Copy className="mr-2 h-4 w-4" />
              Clone
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteClick(row.original)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (plan: Plan) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {plan.displayName || plan.name}
        </span>
        <Badge variant={statusBadgeVariant(plan.status as PlanStatus)}>
          {plan.status}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <Badge variant={tierBadgeVariant(plan.tier as PlanTier)}>
          {plan.tier}
        </Badge>
        <span className="text-muted-foreground">
          {plan.basePriceMonthly != null
            ? `₦${plan.basePriceMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "—"}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link
              href={editPlanHref(plan.id)}
              onClick={() => handleNavClick(editPlanHref(plan.id))}
            >
              {loadingHref === editPlanHref(plan.id) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Edit2 className="mr-2 h-4 w-4" />
              )}
              Edit
            </Link>
          </DropdownMenuItem>
          {plan.status !== "active" && (
            <DropdownMenuItem onClick={() => handleActivateClick(plan)}>
              Activate
            </DropdownMenuItem>
          )}
          {plan.status === "active" && (
            <DropdownMenuItem onClick={() => handleArchiveClick(plan)}>
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handleCloneClick(plan)}>
            <Copy className="mr-2 h-4 w-4" />
            Clone
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleDeleteClick(plan)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const isNavigatingToNew = loadingHref === NEW_PLAN_HREF;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Manage subscription plans"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild className="w-full md:w-auto min-h-[44px]">
                <Link
                  href={NEW_PLAN_HREF}
                  onClick={() => handleNavClick(NEW_PLAN_HREF)}
                >
                  {isNavigatingToNew ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Create Plan
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the plan creation wizard to add a new subscription tier
            </TooltipContent>
          </Tooltip>
        }
      />

      <DataTable
        columns={columns}
        data={plans}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="displayName"
        searchPlaceholder="Search plans..."
        emptyTitle="No plans yet"
        emptyDescription="Create your first subscription plan to get started."
        mobileCard={mobileCard}
      />

      <ConfirmDialog
        open={activateDialogOpen}
        onOpenChange={setActivateDialogOpen}
        title="Activate Plan"
        description={`Are you sure you want to activate "${planToActivate?.displayName || planToActivate?.name}"? This plan will be available to new subscriptions.`}
        confirmLabel="Activate"
        isLoading={activateMutation.isPending}
        onConfirm={handleActivateConfirm}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Plan"
        description={`Are you sure you want to archive "${planToArchive?.displayName || planToArchive?.name}"? New subscriptions will not be able to use this plan.`}
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={handleArchiveConfirm}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Plan"
        description={`Are you sure you want to delete "${planToDelete?.displayName || planToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
