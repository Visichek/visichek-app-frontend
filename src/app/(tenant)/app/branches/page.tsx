"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Edit2,
  Trash2,
  MoreHorizontal,
  PowerOff,
  Loader2,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  useBranches,
  useDeleteBranch,
  useDeactivateBranch,
} from "@/features/branches/hooks/use-branches";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { Branch } from "@/types/tenant";

export default function BranchesPage() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.BRANCH_CREATE);
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const { data, isLoading } = useBranches();
  const deleteMutation = useDeleteBranch();
  const deactivateMutation = useDeactivateBranch();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | undefined>();
  const [branchToDeactivate, setBranchToDeactivate] = useState<
    Branch | undefined
  >();

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
        <RowActions
          branch={row.original}
          onDelete={handleDeleteClick}
          onDeactivate={handleDeactivateClick}
          loadingHref={loadingHref}
          handleNavClick={handleNavClick}
        />
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
      <RowActions
        branch={branch}
        onDelete={handleDeleteClick}
        onDeactivate={handleDeactivateClick}
        loadingHref={loadingHref}
        handleNavClick={handleNavClick}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage physical office locations"
        actions={
          canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild className="w-full md:w-auto min-h-[44px]">
                  <Link
                    href="/app/branches/new"
                    onClick={() => handleNavClick("/app/branches/new")}
                  >
                    {loadingHref === "/app/branches/new" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Add Branch
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the new-branch form to add a branch
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
        searchPlaceholder="Search branches..."
        emptyTitle="No branches"
        emptyDescription="Add your first office location to get started."
        mobileCard={mobileCard}
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

function RowActions({
  branch,
  onDelete,
  onDeactivate,
  loadingHref,
  handleNavClick,
}: {
  branch: Branch;
  onDelete: (b: Branch) => void;
  onDeactivate: (b: Branch) => void;
  loadingHref: string | null;
  handleNavClick: (href: string) => void;
}) {
  const editHref = `/app/branches/${branch.id}/edit`;
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
            Open actions for this branch
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
        {branch.isActive !== false && (
          <DropdownMenuItem onClick={() => onDeactivate(branch)}>
            <PowerOff className="mr-2 h-4 w-4" />
            Deactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => onDelete(branch)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
