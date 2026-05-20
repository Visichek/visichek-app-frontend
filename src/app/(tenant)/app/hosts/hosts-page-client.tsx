"use client";

import { useMemo, useState } from "react";
import { Plus, Edit2, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import {
  DataTable,
  type DataTableBulkAction,
} from "@/components/recipes/data-table";
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
  useHosts,
  useDeleteHost,
  useBulkDeleteHosts,
} from "@/features/hosts/hooks/use-hosts";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { cn } from "@/lib/utils/cn";
import type { Host } from "@/types/host";

const HOSTS_PAGE_SIZE = 25;

export function HostsPageClient() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.HOST_CREATE);
  const canDelete = hasCapability(CAPABILITIES.HOST_DELETE);
  const { loadingHref } = useNavigationLoading();

  const [pageIndex, setPageIndex] = useState(0);

  const listFilters = useMemo(
    () => ({
      skip: pageIndex * HOSTS_PAGE_SIZE,
      limit: HOSTS_PAGE_SIZE,
      sort: "name",
    }),
    [pageIndex],
  );

  const { data: hostsList, isLoading } = useHosts(listFilters);
  const data = hostsList?.items ?? [];
  const meta = hostsList?.meta;

  // Resolve department names for the column (list rows carry only the id).
  const departmentsQuery = useDepartments({ skip: 0, limit: 200, sort: "name" });
  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departmentsQuery.data?.items ?? []) {
      if (d?.id) map.set(d.id, d.name);
    }
    return map;
  }, [departmentsQuery.data]);

  const deleteQuery = useDeleteHost();
  const bulkDeleteQuery = useBulkDeleteHosts();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hostToDelete, setHostToDelete] = useState<Host | undefined>();
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const handleDeleteClick = (host: Host) => {
    setHostToDelete(host);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!hostToDelete) return;
    try {
      await deleteQuery.mutateAsync(hostToDelete.id);
      toast.success("Host deleted");
      setDeleteDialogOpen(false);
      setHostToDelete(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete host",
      );
    }
  };

  async function handleBulkDeleteConfirm() {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setBulkPending(true);
    try {
      const result = await bulkDeleteQuery.mutateAsync({ ids: bulkDeleteIds });
      const { tone, message } = summarizeBulkResult(result, "host", "deleted");
      toast[tone](message);
      setBulkDeleteIds(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk delete failed");
    } finally {
      setBulkPending(false);
    }
  }

  const bulkActions: DataTableBulkAction<Host>[] = canDelete
    ? [
        {
          label: "Delete",
          description:
            "Permanently delete every selected host — this cannot be undone",
          icon: <Trash2 className="h-4 w-4" />,
          variant: "destructive",
          onClick: (ids) => {
            if (ids.length > 0) setBulkDeleteIds(ids);
          },
        },
      ]
    : [];

  const columns: ColumnDef<Host>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      id: "department",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {departmentNameById.get(row.original.departmentId) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="hidden text-sm md:inline">
          {row.original.phone || "—"}
        </span>
      ),
    },
    {
      id: "source",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.sourceSystemUserId ? "System user" : "Dedicated"}
        </span>
      ),
    },
    {
      id: "active",
      header: "Status",
      cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          host={row.original}
          canDelete={canDelete}
          onDelete={handleDeleteClick}
        />
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (host: Host) => (
    <div className="rounded-lg border p-4 flex items-center justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <span className="block truncate font-medium">{host.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {departmentNameById.get(host.departmentId) ?? "—"} · {host.phone}
        </span>
        <ActiveBadge active={host.isActive} />
      </div>
      <RowActions
        host={host}
        canDelete={canDelete}
        onDelete={handleDeleteClick}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hosts"
        description="Manage the people visitors can be scheduled to see, including those without a login account."
        actions={
          canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href="/app/hosts/new"
                  className="w-full md:w-auto min-h-[44px]"
                >
                  {loadingHref === "/app/hosts/new" ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Add Host
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the new-host form to add someone visitors can be scheduled
                to see
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination
        serverPagination={{
          pageIndex,
          pageSize: HOSTS_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        searchKey="name"
        searchPlaceholder="Search hosts..."
        emptyTitle="No hosts"
        emptyDescription="Add your first host to schedule appointments against them."
        mobileCard={mobileCard}
        selectable={canDelete}
        getRowId={(host) => host.id}
        itemNoun="host"
        bulkActions={bulkActions}
        getRowHref={(host) => `/app/hosts/${host.id}/edit`}
        rowClickAriaLabel={(host) => `View details for host ${host.name}`}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete host"
        description={`Are you sure you want to delete "${hostToDelete?.name}"? This action cannot be undone.`}
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
        title={`Delete ${bulkDeleteIds?.length ?? 0} host${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}`}
        description={`Permanently delete ${bulkDeleteIds?.length ?? 0} host${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={bulkPending}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RowActions({
  host,
  canDelete,
  onDelete,
}: {
  host: Host;
  canDelete: boolean;
  onDelete: (h: Host) => void;
}) {
  const editHref = `/app/hosts/${host.id}/edit`;
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
        <TooltipContent side="left">Open actions for this host</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuNavItem
          href={editHref}
          label="Edit"
          icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
        />
        {canDelete && (
          <DropdownMenuItem
            onClick={() => onDelete(host)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
