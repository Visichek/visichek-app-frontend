"use client";

import { useMemo, useState } from "react";
import { Plus, Edit2, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable, type DataTableBulkAction } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { NavButton } from "@/components/recipes/nav-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  useDepartments,
  useDeleteDepartment,
  useBulkDeleteDepartments,
} from "@/features/departments/hooks/use-departments";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useCapability } from "@/features/limitations/hooks/use-limitations";
import { LockedBadge } from "@/features/limitations/components/locked-badge";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { cn } from "@/lib/utils/cn";
import type { Department } from "@/types/tenant";

export function DepartmentsPageClient() {
  const { hasCapability } = useCapabilities();
  const {
    isDepartmentLocked,
    capFor,
    limitations,
    isFreeFallback,
  } = useCapability();
  const planLabel = limitations?.plan?.displayName ?? limitations?.plan?.name;
  const canCreate = hasCapability(CAPABILITIES.DEPARTMENT_CREATE);
  const { loadingHref } = useNavigationLoading();

  const DEPARTMENTS_PAGE_SIZE = 25;
  const [pageIndex, setPageIndex] = useState(0);

  const listFilters = useMemo(
    () => ({
      skip: pageIndex * DEPARTMENTS_PAGE_SIZE,
      limit: DEPARTMENTS_PAGE_SIZE,
      sort: "name",
    }),
    [pageIndex],
  );

  const { data: departmentsList, isLoading } = useDepartments(listFilters);
  const data = departmentsList?.items ?? [];
  const meta = departmentsList?.meta;
  const deptCap = capFor("maxDepartments");
  const lockedCount = useMemo(
    () => data.filter((d) => isDepartmentLocked(d.id)).length,
    [data, isDepartmentLocked],
  );
  const deleteQuery = useDeleteDepartment();
  const bulkDeleteQuery = useBulkDeleteDepartments();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | undefined>();
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const handleDeleteClick = (dept: Department) => {
    setDeptToDelete(dept);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deptToDelete) return;
    try {
      await deleteQuery.mutateAsync(deptToDelete.id);
      toast.success("Department deleted successfully");
      setDeleteDialogOpen(false);
      setDeptToDelete(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete department"
      );
    }
  };

  async function handleBulkDeleteConfirm() {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setBulkPending(true);
    try {
      const result = await bulkDeleteQuery.mutateAsync({ ids: bulkDeleteIds });
      const { tone, message } = summarizeBulkResult(result, "department", "deleted");
      toast[tone](message);
      setBulkDeleteIds(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk delete failed");
    } finally {
      setBulkPending(false);
    }
  }

  const bulkActions: DataTableBulkAction<Department>[] = [
    {
      label: "Delete",
      description: "Permanently delete every selected department — this cannot be undone",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (ids) => {
        if (ids.length > 0) setBulkDeleteIds(ids);
      },
    },
  ];

  const columns: ColumnDef<Department>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const locked = isDepartmentLocked(row.original.id);
        return (
          <span
            className={cn(
              "flex items-center gap-2 font-medium",
              locked && "text-muted-foreground",
            )}
          >
            {row.original.name}
            {locked && <LockedBadge noun="department" planLabel={planLabel} />}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          dept={row.original}
          locked={isDepartmentLocked(row.original.id)}
          onDelete={handleDeleteClick}
        />
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (dept: Department) => {
    const locked = isDepartmentLocked(dept.id);
    return (
      <div
        className={cn(
          "rounded-lg border p-4 flex items-center justify-between gap-2",
          locked && "opacity-60",
        )}
      >
        <span
          className={cn(
            "flex items-center gap-2 font-medium",
            locked && "text-muted-foreground",
          )}
        >
          {dept.name}
          {locked && <LockedBadge noun="department" planLabel={planLabel} />}
        </span>
        <RowActions
          dept={dept}
          locked={locked}
          onDelete={handleDeleteClick}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage your organization's departments"
        actions={
          canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton href="/app/departments/new" className="w-full md:w-auto min-h-[44px]">
                  {loadingHref === "/app/departments/new" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Add Department
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the new-department form to add a department
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      />

      {lockedCount > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10"
          role="status"
        >
          <div className="space-y-1">
            <p className="font-medium">
              {lockedCount} department{lockedCount === 1 ? "" : "s"} locked
              under {planLabel ?? "your current plan"}
            </p>
            <p className="text-muted-foreground">
              {isFreeFallback
                ? "Your subscription dropped to Free, so departments above the cap were locked. Re-upgrade to bring them back, or delete them to free up the slot."
                : `Your plan only includes ${
                    deptCap ?? 1
                  } department${deptCap === 1 ? "" : "s"}. Upgrade to unlock the rest, or delete the locked rows.`}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: DEPARTMENTS_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          onPageChange: setPageIndex,
        }}
        searchKey="name"
        searchPlaceholder="Search departments..."
        emptyTitle="No departments"
        emptyDescription="Create your first department to get started."
        mobileCard={mobileCard}
        selectable
        getRowId={(dept) => dept.id}
        itemNoun="department"
        bulkActions={bulkActions}
        getRowHref={(dept) => `/app/departments/${dept.id}/edit`}
        rowClickAriaLabel={(dept) => `View details for department ${dept.name}`}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Department"
        description={`Are you sure you want to delete "${deptToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteQuery.isPending}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmDialog
        open={bulkDeleteIds !== null}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteIds(null);
        }}
        title={`Delete ${bulkDeleteIds?.length ?? 0} department${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}`}
        description={`Permanently delete ${bulkDeleteIds?.length ?? 0} department${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={bulkPending}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
}

function RowActions({
  dept,
  locked = false,
  onDelete,
}: {
  dept: Department;
  locked?: boolean;
  onDelete: (d: Department) => void;
}) {
  const editHref = `/app/departments/${dept.id}/edit`;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          {locked
            ? "Locked department — only delete is available"
            : "Open actions for this department"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {!locked && (
          <DropdownMenuNavItem
            href={editHref}
            label="Edit"
            icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
          />
        )}
        <DropdownMenuItem
          onClick={() => onDelete(dept)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
