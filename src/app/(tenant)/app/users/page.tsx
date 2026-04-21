"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, Edit2, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
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
  useSystemUsers,
  useDeleteSystemUser,
} from "@/features/users/hooks/use-users";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import type { SystemUser } from "@/types/user";

export default function UsersPage() {
  const { data, isLoading } = useSystemUsers();
  const deleteMutation = useDeleteSystemUser();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SystemUser | undefined>();

  const handleDeleteClick = (user: SystemUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await deleteMutation.mutateAsync(userToDelete.id);
      toast.success("User deleted successfully");
      setDeleteDialogOpen(false);
      setUserToDelete(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete user"
      );
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "super_admin":
        return "default" as const;
      case "dept_admin":
      case "receptionist":
      case "auditor":
      case "security_officer":
      case "dpo":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  const columns: ColumnDef<SystemUser>[] = [
    {
      accessorKey: "fullName",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={getRoleBadgeVariant(row.original.role)}>
          {row.original.role.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
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
                Open actions for this user
              </TooltipContent>
            </Tooltip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit (Coming soon)
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

  const mobileCard = (user: SystemUser) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{user.fullName}</span>
        <Badge variant={getRoleBadgeVariant(user.role)}>
          {user.role.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground">{user.email}</div>
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
              Open actions for this user
            </TooltipContent>
          </Tooltip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit (Coming soon)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleDeleteClick(user)}
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
        title="Users"
        description="Manage staff accounts and roles"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild className="w-full md:w-auto min-h-[44px]">
                <Link
                  href="/app/users/new"
                  onClick={() => handleNavClick("/app/users/new")}
                >
                  {loadingHref === "/app/users/new" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Invite User
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the new-user form to invite a new staff member
            </TooltipContent>
          </Tooltip>
        }
      />

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="fullName"
        searchPlaceholder="Search users..."
        emptyTitle="No users"
        emptyDescription="Invite your first team member to get started."
        mobileCard={mobileCard}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete User"
        description={`Are you sure you want to delete "${userToDelete?.fullName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
