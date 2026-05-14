"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Edit2,
  Copy,
  Trash2,
  MoreHorizontal,
  Loader2,
  Archive,
  CheckCircle2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable, type DataTableBulkAction } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { NavButton } from "@/components/recipes/nav-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useBulkPlanAction,
} from "@/features/plans/hooks/use-plans";
import { summarizeBulkResult } from "@/lib/api/bulk";
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
    case "premium":
      return "success" as const;
    case "enterprise":
      return "default" as const;
    case "professional":
    case "custom":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

// Singleton (canonical) plans — exactly one row each, name-locked, and the
// backend rejects archive/delete on them. Enterprise plans are PLURAL —
// each one has a unique slug and can be freely archived or deleted.
const CANONICAL_PLAN_NAMES = new Set(["free", "starter", "premium"]);

function isCanonicalPlan(plan: Plan): boolean {
  return CANONICAL_PLAN_NAMES.has(plan.name);
}

type PlanStatusTab = "active" | "archived" | "all";

const PLAN_TABS: { value: PlanStatusTab; label: string; description: string }[] = [
  {
    value: "active",
    label: "Active",
    description: "Plans currently offered to new and existing subscriptions",
  },
  {
    value: "archived",
    label: "Archived",
    description: "Plans no longer offered to new subscriptions — existing subscriptions are unaffected",
  },
  {
    value: "all",
    label: "All",
    description: "Show every plan regardless of status (including drafts)",
  },
];

export function PlansPageClient() {
  const { loadingHref } = useNavigationLoading();

  const [statusTab, setStatusTab] = useState<PlanStatusTab>("active");

  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: 0,
      limit: 50,
      sort: "-dateCreated",
      facets: "status",
    };
    if (statusTab !== "all") params.status = statusTab;
    return params;
  }, [statusTab]);

  const { data, isLoading } = usePlans(listFilters);
  const plans = data?.items ?? [];
  const meta = data?.meta;

  const tabCounts = useMemo(() => {
    const facet = meta?.facets?.status ?? {};
    return {
      active: facet.active ?? 0,
      archived: facet.archived ?? 0,
      all: facet.all ?? meta?.total ?? 0,
    };
  }, [meta]);
  const deleteMutation = useDeletePlan();
  const activateMutation = useActivatePlan();
  const archiveMutation = useArchivePlan();
  const cloneMutation = useClonePlan();
  const bulkActivate = useBulkPlanAction("activate");
  const bulkArchive = useBulkPlanAction("archive");
  const bulkDelete = useBulkPlanAction("delete");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | undefined>();
  const [planToActivate, setPlanToActivate] = useState<Plan | undefined>();
  const [planToArchive, setPlanToArchive] = useState<Plan | undefined>();

  type BulkOp = "delete" | "archive" | "activate";
  const [bulkOp, setBulkOp] = useState<BulkOp | null>(null);
  const [bulkTargetIds, setBulkTargetIds] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);

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

  function openBulkConfirm(op: BulkOp, ids: string[]) {
    if (ids.length === 0) return;
    setBulkOp(op);
    setBulkTargetIds(ids);
  }

  async function handleBulkConfirm() {
    if (!bulkOp || bulkTargetIds.length === 0) return;
    const op = bulkOp;
    const ids = bulkTargetIds;
    const verbPast: Record<BulkOp, string> = {
      delete: "deleted",
      archive: "archived",
      activate: "activated",
    };
    const hooks: Record<BulkOp, typeof bulkDelete> = {
      delete: bulkDelete,
      archive: bulkArchive,
      activate: bulkActivate,
    };
    setBulkPending(true);
    try {
      const result = await hooks[op].mutateAsync({ ids });
      const { tone, message } = summarizeBulkResult(result, "plan", verbPast[op]);
      toast[tone](message);
      setBulkOp(null);
      setBulkTargetIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Bulk ${op} failed`);
    } finally {
      setBulkPending(false);
    }
  }

  const bulkActions: DataTableBulkAction<Plan>[] = [
    {
      label: "Activate",
      description: "Activate every selected plan so it is available to new subscriptions",
      icon: <CheckCircle2 className="h-4 w-4" />,
      variant: "default",
      onClick: (ids, rows) => {
        const eligible = rows.filter((p) => p.status !== "active").map((p) => p.id);
        if (eligible.length === 0) {
          toast.info("All selected plans are already active");
          return;
        }
        openBulkConfirm("activate", eligible);
      },
    },
    {
      label: "Archive",
      description: "Archive every selected plan so new subscriptions cannot use it. Singleton plans (free, starter, premium) are skipped.",
      icon: <Archive className="h-4 w-4" />,
      variant: "secondary",
      onClick: (ids, rows) => {
        const eligible = rows
          .filter((p) => p.status === "active" && !isCanonicalPlan(p))
          .map((p) => p.id);
        if (eligible.length === 0) {
          toast.info(
            "None of the selected plans can be archived — free/starter/premium are protected and the rest are not active"
          );
          return;
        }
        openBulkConfirm("archive", eligible);
      },
    },
    {
      label: "Delete",
      description: "Permanently delete every selected plan — this cannot be undone. Singleton plans (free, starter, premium) are skipped.",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (ids, rows) => {
        const eligible = rows
          .filter((p) => !isCanonicalPlan(p))
          .map((p) => p.id);
        if (eligible.length === 0) {
          toast.info("Free, Starter, and Premium plans cannot be deleted");
          return;
        }
        openBulkConfirm("delete", eligible);
      },
    },
  ];

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
            <DropdownMenuNavItem
              href={editPlanHref(row.original.id)}
              label="Edit"
              icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
            />
            {row.original.status !== "active" && (
              <DropdownMenuItem onClick={() => handleActivateClick(row.original)}>
                Activate
              </DropdownMenuItem>
            )}
            {row.original.status === "active" && !isCanonicalPlan(row.original) && (
              <DropdownMenuItem onClick={() => handleArchiveClick(row.original)}>
                Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleCloneClick(row.original)}>
              <Copy className="mr-2 h-4 w-4" />
              Clone
            </DropdownMenuItem>
            {!isCanonicalPlan(row.original) && (
              <DropdownMenuItem
                onClick={() => handleDeleteClick(row.original)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
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
          <DropdownMenuNavItem
            href={editPlanHref(plan.id)}
            label="Edit"
            icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
          />
          {plan.status !== "active" && (
            <DropdownMenuItem onClick={() => handleActivateClick(plan)}>
              Activate
            </DropdownMenuItem>
          )}
          {plan.status === "active" && !isCanonicalPlan(plan) && (
            <DropdownMenuItem onClick={() => handleArchiveClick(plan)}>
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handleCloneClick(plan)}>
            <Copy className="mr-2 h-4 w-4" />
            Clone
          </DropdownMenuItem>
          {!isCanonicalPlan(plan) && (
            <DropdownMenuItem
              onClick={() => handleDeleteClick(plan)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
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
              <NavButton href={NEW_PLAN_HREF} className="w-full md:w-auto min-h-[44px]">
                {isNavigatingToNew ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Create Plan
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the plan creation wizard to add a new subscription tier
            </TooltipContent>
          </Tooltip>
        }
      />

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as PlanStatusTab)}
      >
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {PLAN_TABS.map((tab) => (
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

      <DataTable
        columns={columns}
        data={plans}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="displayName"
        searchPlaceholder="Search plans..."
        emptyTitle={
          statusTab === "archived"
            ? "No archived plans"
            : statusTab === "active"
              ? "No active plans"
              : "No plans yet"
        }
        emptyDescription={
          statusTab === "archived"
            ? "Plans you archive will appear here. Archived plans are not offered to new subscriptions."
            : statusTab === "active"
              ? "Activate or create a plan to make it available to new subscriptions."
              : "Create your first subscription plan to get started."
        }
        mobileCard={mobileCard}
        selectable
        getRowId={(plan) => plan.id}
        itemNoun="plan"
        bulkActions={bulkActions}
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

      <ConfirmDialog
        open={bulkOp !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkOp(null);
            setBulkTargetIds([]);
          }
        }}
        title={
          bulkOp === "delete"
            ? `Delete ${bulkTargetIds.length} plan${bulkTargetIds.length === 1 ? "" : "s"}`
            : bulkOp === "archive"
              ? `Archive ${bulkTargetIds.length} plan${bulkTargetIds.length === 1 ? "" : "s"}`
              : bulkOp === "activate"
                ? `Activate ${bulkTargetIds.length} plan${bulkTargetIds.length === 1 ? "" : "s"}`
                : ""
        }
        description={
          bulkOp === "delete"
            ? `Permanently delete ${bulkTargetIds.length} plan${bulkTargetIds.length === 1 ? "" : "s"}. This cannot be undone.`
            : bulkOp === "archive"
              ? `Archive ${bulkTargetIds.length} active plan${bulkTargetIds.length === 1 ? "" : "s"}. New subscriptions will not be able to use them.`
              : bulkOp === "activate"
                ? `Activate ${bulkTargetIds.length} plan${bulkTargetIds.length === 1 ? "" : "s"} so they are offered to new subscriptions.`
                : ""
        }
        confirmLabel={
          bulkOp === "delete" ? "Delete" : bulkOp === "archive" ? "Archive" : "Activate"
        }
        variant={bulkOp === "delete" ? "destructive" : "default"}
        isLoading={bulkPending}
        onConfirm={handleBulkConfirm}
      />
    </div>
  );
}
