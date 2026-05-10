"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Edit2,
  Trash2,
  KeyRound,
  ShieldAlert,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable, type DataTableBulkAction } from "@/components/recipes/data-table";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  useResetUserPassword,
  useBulkSystemUserAction,
} from "@/features/users/hooks/use-users";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { useBranches } from "@/features/branches/hooks/use-branches";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import { isBranchScopedRole } from "@/lib/permissions/roles";
import { isSuperAdminDeleteBlocked, superAdminDeleteHint } from "@/types/api";
import { EditUserDialog } from "@/features/users/components/edit-user-dialog";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";
import type { SystemUser } from "@/types/user";
import type { Branch } from "@/types/tenant";

export function UsersPageClient() {
  const { data: usersList, isLoading } = useSystemUsers({ limit: 200, sort: "-dateCreated" });
  const data = usersList?.items ?? [];
  const branchesQuery = useBranches();
  const deleteMutation = useDeleteSystemUser();
  const resetPassword = useResetUserPassword();
  const bulkDeleteUsers = useBulkSystemUserAction("delete");
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { systemUserProfile, currentRole } = useSession();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SystemUser | undefined>();

  const [editTarget, setEditTarget] = useState<SystemUser | null>(null);
  const [resetTarget, setResetTarget] = useState<SystemUser | null>(null);

  const [superAdminBlockedHint, setSuperAdminBlockedHint] = useState<
    string | null
  >(null);

  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkSkippedCount, setBulkSkippedCount] = useState(0);
  const [bulkPending, setBulkPending] = useState(false);

  async function handleBulkDeleteConfirm() {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setBulkPending(true);
    try {
      const result = await bulkDeleteUsers.mutateAsync({ ids: bulkDeleteIds });
      const skipped = bulkSkippedCount;
      const skippedSuffix = skipped > 0 ? ` (${skipped} protected row${skipped === 1 ? "" : "s"} skipped on the FE)` : "";
      const { tone, message } = summarizeBulkResult(result, "user", "deleted");
      toast[tone](message + skippedSuffix);
      setBulkDeleteIds(null);
      setBulkSkippedCount(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk delete failed");
    } finally {
      setBulkPending(false);
    }
  }

  const branchById = useMemo(() => {
    const map = new Map<string, Branch>();
    (branchesQuery.data?.items ?? []).forEach((b) => map.set(b.id, b));
    return map;
  }, [branchesQuery.data]);

  // Super_admins always see all branches in the tenant; for branch-scoped
  // viewers (which can't normally reach this page anyway) the column
  // collapses since every visible row sits on their own branch.
  const showBranchColumn = !isBranchScopedRole(currentRole);

  const handleDeleteClick = (user: SystemUser) => {
    // Spec: PREFERRED — hide / disable the [Remove user] button on
    // super_admin rows. The 400 should never need to fire in the happy
    // path, but we still defend against the race below.
    if (user.role === "super_admin") {
      setSuperAdminBlockedHint(
        "Super admins can't be removed from user management. Use tenant offboarding (application admin only) to remove the tenant entirely, or transfer the role first."
      );
      return;
    }
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
      // Race-condition fallback: if the row was a super_admin by the
      // time the request hit the server we get the structured 400.
      if (isSuperAdminDeleteBlocked(error)) {
        setDeleteDialogOpen(false);
        setUserToDelete(undefined);
        setSuperAdminBlockedHint(
          superAdminDeleteHint(error) ??
            "Super admins can't be removed from user management."
        );
        return;
      }
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

  const formatBranches = (user: SystemUser): React.ReactNode => {
    // Phase 4 will ship `branchSummary` per row. Until then, fall back
    // to looking up the user's `branchIds` against the tenant's branch
    // list. If neither is present (legacy row), assume HQ — the server
    // backfill ensures every user lands on at least one branch.
    if (user.branchSummary) {
      return (
        <Badge variant="outline" className="font-normal">
          {user.branchSummary.name}
        </Badge>
      );
    }

    const ids = user.branchIds ?? [];
    if (ids.length === 0) {
      return (
        <Badge variant="outline" className="font-normal">
          HQ
        </Badge>
      );
    }
    if (ids.length === 1) {
      const b = branchById.get(ids[0]);
      return (
        <Badge variant="outline" className="font-normal">
          {b?.name ?? "—"}
        </Badge>
      );
    }
    const first = branchById.get(ids[0])?.name ?? "branch";
    return (
      <span className="text-sm">
        <Badge variant="outline" className="font-normal mr-1">
          {first}
        </Badge>
        <span className="text-muted-foreground">+{ids.length - 1} more</span>
      </span>
    );
  };

  const isSelf = (user: SystemUser) =>
    !!systemUserProfile?.id && systemUserProfile.id === user.id;

  const renderActions = (user: SystemUser) => {
    const isSuperAdminRow = user.role === "super_admin";
    const targetingSelf = isSelf(user);

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
            Open actions for this user
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditTarget(user)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {!targetingSelf && (
            <DropdownMenuItem onClick={() => setResetTarget(user)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Reset password
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleDeleteClick(user)}
            disabled={isSuperAdminRow}
            className={
              isSuperAdminRow ? "text-muted-foreground" : "text-destructive"
            }
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isSuperAdminRow ? "Delete (protected)" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const bulkActions: DataTableBulkAction<SystemUser>[] = [
    {
      label: "Delete",
      description: "Permanently delete every selected user — super_admin rows are skipped automatically",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (_ids, rows) => {
        const eligible = rows
          .filter((u) => u.role !== "super_admin")
          .filter((u) => !isSelf(u))
          .map((u) => u.id);
        const skipped = rows.length - eligible.length;
        if (eligible.length === 0) {
          toast.info("No eligible users selected — super_admins and your own account cannot be deleted here");
          return;
        }
        setBulkSkippedCount(skipped);
        setBulkDeleteIds(eligible);
      },
    },
  ];

  const columns: ColumnDef<SystemUser>[] = [
    {
      accessorKey: "fullName",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.fullName}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.email}
        </span>
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
    ...(showBranchColumn
      ? [
          {
            id: "branches",
            header: "Branches",
            cell: ({ row }) => formatBranches(row.original),
          } satisfies ColumnDef<SystemUser>,
        ]
      : []),
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => renderActions(row.original),
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
      {showBranchColumn && (
        <div className="text-xs text-muted-foreground">
          Branches: {formatBranches(user)}
        </div>
      )}
      {renderActions(user)}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage staff accounts, roles, and branch assignments"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild className="w-full md:w-auto min-h-[44px]">
                <Link
                  href="/app/users/new"
                  onClick={() => handleNavClick("/app/users/new")}
                >
                  {loadingHref === "/app/users/new" ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
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
        selectable
        getRowId={(user) => user.id}
        itemNoun="user"
        bulkActions={bulkActions}
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

      <ConfirmDialog
        open={bulkDeleteIds !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDeleteIds(null);
            setBulkSkippedCount(0);
          }
        }}
        title={`Delete ${bulkDeleteIds?.length ?? 0} user${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}`}
        description={
          bulkSkippedCount > 0
            ? `Permanently delete ${bulkDeleteIds?.length ?? 0} user${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}. ${bulkSkippedCount} protected row${bulkSkippedCount === 1 ? "" : "s"} (super_admin or yourself) will be skipped. This cannot be undone.`
            : `Permanently delete ${bulkDeleteIds?.length ?? 0} user${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}. This cannot be undone.`
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={bulkPending}
        onConfirm={handleBulkDeleteConfirm}
      />

      <EditUserDialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        user={editTarget}
      />

      <ResetPasswordDialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        target={resetTarget}
        onReset={resetPassword.mutateAsync}
        isPending={resetPassword.isPending}
      />

      <AlertDialog
        open={!!superAdminBlockedHint}
        onOpenChange={(open) => {
          if (!open) setSuperAdminBlockedHint(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert
                className="h-5 w-5 text-amber-600"
                aria-hidden="true"
              />
              Super admins can&apos;t be removed from here
            </AlertDialogTitle>
            <AlertDialogDescription>
              {superAdminBlockedHint}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => setSuperAdminBlockedHint(null)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
