"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, MoreHorizontal } from "lucide-react";
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
import { LoadingButton } from "@/components/feedback/loading-button";
import { toast } from "sonner";
import {
  useDepartments,
  useDeleteDepartment,
} from "@/features/departments/hooks/use-departments";
import { DepartmentFormModal } from "@/features/departments/components/department-form-modal";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { Department } from "@/types/tenant";

export default function DepartmentsPage() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.DEPARTMENT_CREATE);

  const { data, isLoading, isError, refetch } = useDepartments();
  const deleteQuery = useDeleteDepartment();

  const [formOpen, setFormOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | undefined>();

  const handleEdit = (dept: Department) => {
    setSelectedDept(dept);
    setFormOpen(true);
  };

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
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

  const mobileCard = (dept: Department) => (
    <div className="rounded-lg border p-4 flex items-center justify-between">
      <span className="font-medium">{dept.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleEdit(dept)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleDeleteClick(dept)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage your organization's departments"
        actions={
          canCreate ? (
            <Button
              className="w-full md:w-auto min-h-[44px]"
              onClick={() => {
                setSelectedDept(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add Department
            </Button>
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

      <DepartmentFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setSelectedDept(undefined);
          }
        }}
        department={selectedDept}
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
