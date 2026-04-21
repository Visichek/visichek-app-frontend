"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
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
} from "@/features/departments/hooks/use-departments";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { Department } from "@/types/tenant";

export default function DepartmentsPage() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.DEPARTMENT_CREATE);
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const { data, isLoading } = useDepartments();
  const deleteQuery = useDeleteDepartment();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | undefined>();

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
      <DropdownMenuTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Open actions for this department
          </TooltipContent>
        </Tooltip>
      </DropdownMenuTrigger>
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
