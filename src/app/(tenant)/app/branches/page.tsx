"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
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
import {
  useBranches,
  useDeleteBranch,
  useDeactivateBranch,
} from "@/features/branches/hooks/use-branches";
import { BranchFormModal } from "@/features/branches/components/branch-form-modal";
import type { Branch } from "@/types/tenant";

export default function BranchesPage() {
  const { data, isLoading } = useBranches();
  const deleteMutation = useDeleteBranch();
  const deactivateMutation = useDeactivateBranch();

  const [formOpen, setFormOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | undefined>();
  const [branchToDeactivate, setBranchToDeactivate] = useState<
    Branch | undefined
  >();

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormOpen(true);
  };

  const handleDeleteClick = (branch: Branch) => {
    setBranchToDelete(branch);
    setDeleteDialogOpen(true);
  };

  const handleDeactivateClick = (branch: Branch) => {
    setBranchToDeactivate(branch);
    setDeactivateDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!branchToDelete) return;
    try {
      await deleteMutation.mutateAsync(branchToDelete.id);
      toast.success("Branch deleted successfully");
      setDeleteDialogOpen(false);
      setBranchToDelete(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete branch"
      );
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!branchToDeactivate) return;
    try {
      await deactivateMutation.mutateAsync(branchToDeactivate.id);
      toast.success("Branch deactivated successfully");
      setDeactivateDialogOpen(false);
      setBranchToDeactivate(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to deactivate branch"
      );
    }
  };

  const columns: ColumnDef<Branch>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.address || "—"}
        </span>
      ),
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.city || "—"}
        </span>
      ),
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.state || "—"}
        </span>
      ),
    },
    {
      id: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.isActive === false ? "secondary" : "success"
          }
        >
          {row.original.isActive === false ? "Inactive" : "Active"}
        </Badge>
      ),
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
            {row.original.isActive !== false && (
              <DropdownMenuItem
                onClick={() => handleDeactivateClick(row.original)}
              >
                Deactivate
              </DropdownMenuItem>
            )}
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

  const mobileCard = (branch: Branch) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{branch.name}</span>
        <Badge
          variant={
            branch.isActive === false ? "secondary" : "success"
          }
        >
          {branch.isActive === false ? "Inactive" : "Active"}
        </Badge>
      </div>
      {branch.address && (
        <div className="text-sm text-muted-foreground">{branch.address}</div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleEdit(branch)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {branch.isActive !== false && (
            <DropdownMenuItem
              onClick={() => handleDeactivateClick(branch)}
            >
              Deactivate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => handleDeleteClick(branch)}
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
        title="Branches"
        description="Manage physical office locations"
        actions={
          <Button
            className="w-full md:w-auto min-h-[44px]"
            onClick={() => {
              setSelectedBranch(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add Branch
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="name"
        searchPlaceholder="Search branches..."
        emptyTitle="No branches"
        emptyDescription="Add your first office location to get started."
        mobileCard={mobileCard}
      />

      <BranchFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setSelectedBranch(undefined);
          }
        }}
        branch={selectedBranch}
      />

      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title="Deactivate Branch"
        description={`Are you sure you want to deactivate "${branchToDeactivate?.name}"? Staff will no longer be able to use this location.`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onConfirm={handleDeactivateConfirm}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Branch"
        description={`Are you sure you want to delete "${branchToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
