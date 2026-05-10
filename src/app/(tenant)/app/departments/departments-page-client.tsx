"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable, type DataTableBulkAction } from "@/components/recipes/data-table";
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
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { Department } from "@/types/tenant";

export function DepartmentsPageClient() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.DEPARTMENT_CREATE);
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const { data: departmentsList, isLoading } = useDepartments({ limit: 200, sort: "name" });
  const data = departmentsList?.items ?? [];
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
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          dept={row.original}
          onDelete={handleDeleteClick}
          loadingHref={loadingHref}
          handleNavClick={handleNavClick}
        />
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (dept: Department) => (
    <div className="rounded-lg border p-4 flex items-center justify-between">
      <span className="font-medium">{dept.name}</span>
      <RowActions
        dept={dept}
        onDelete={handleDeleteClick}
        loadingHref={loadingHref}
        handleNavClick={handleNavClick}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage your organization's departments"
        actions={
          canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild className="w-full md:w-auto min-h-[44px]">
                  <Link
                    href="/app/departments/new"
                    onClick={() => handleNavClick("/app/departments/new")}
                  >
                    {loadingHref === "/app/departments/new" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Add Department
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the new-department form to add a department
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="name"
        searchPlaceholder="Search departments..."
        emptyTitle="No departments"
        emptyDescription="Create your first department to get started."
        mobileCard={mobileCard}
        selectable
        getRowId={(dept) => dept.id}
        itemNoun="department"
        bulkActions={bulkActions}
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
  onDelete,
  loadingHref,
  handleNavClick,
}: {
  dept: Department;
  onDelete: (d: Department) => void;
  loadingHref: string | null;
  handleNavClick: (href: string) => void;
}) {
  const editHref = `/app/departments/${dept.id}/edit`;
  const isLoadingEdit = loadingHref === editHref;
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
          Open actions for this department
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link
            href={editHref}
            onClick={() => handleNavClick(editHref)}
            className="flex items-center"
          >
            {isLoadingEdit ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Edit2 className="mr-2 h-4 w-4" />
            )}
            Edit
          </Link>
        </DropdownMenuItem>
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
