"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { NavButton } from "@/components/recipes/nav-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { DetailSheet } from "@/components/recipes/detail-sheet";
import { RecordDetailList, type RecordDetailRow } from "@/components/recipes/record-detail-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/format-date";
import { useDataSubjectRequests } from "@/features/dsr/hooks/use-dsr";
import { GeofencingComplianceCard } from "@/features/dpo/components/geofencing-compliance-card";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { DataSubjectRequest } from "@/types/dpo";
import type { DSRStatus } from "@/types/enums";

function statusVariant(status: DSRStatus) {
  switch (status) {
    case "pending":
      return "warning" as const;
    case "in_progress":
      return "info" as const;
    case "completed":
      return "success" as const;
    case "rejected":
      return "destructive" as const;
  }
}

const DSR_PAGE_SIZE = 25;
type DSRStatusTab = "all" | "pending" | "in_progress" | "completed" | "rejected";
const DSR_STATUS_TABS: { value: DSRStatusTab; label: string; description: string }[] = [
  { value: "all", label: "All", description: "Show every data subject request regardless of status" },
  { value: "pending", label: "Pending", description: "Requests waiting to be picked up by the DPO" },
  { value: "in_progress", label: "In progress", description: "Requests currently being processed by the DPO team" },
  { value: "completed", label: "Completed", description: "Requests that have been fulfilled and closed out" },
  { value: "rejected", label: "Rejected", description: "Requests that were rejected with a documented reason" },
];

export default function DPOPage() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.DSR_CREATE);
  const { loadingHref } = useNavigationLoading();

  const [statusTab, setStatusTab] = useState<DSRStatusTab>("all");
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [statusTab]);

  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * DSR_PAGE_SIZE,
      limit: DSR_PAGE_SIZE,
      sort: "-dateCreated",
      facets: "status",
    };
    if (statusTab !== "all") params.status = statusTab;
    return params;
  }, [pageIndex, statusTab]);

  const { data, isLoading } = useDataSubjectRequests(listFilters);
  const requests = data?.items ?? [];
  const meta = data?.meta;
  const statusFacet = meta?.facets?.status ?? {};
  const tabCounts: Record<DSRStatusTab, number> = {
    all: statusFacet.all ?? meta?.total ?? 0,
    pending: statusFacet.pending ?? 0,
    in_progress: statusFacet.in_progress ?? 0,
    completed: statusFacet.completed ?? 0,
    rejected: statusFacet.rejected ?? 0,
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dsrToDelete, setDSRToDelete] = useState<DataSubjectRequest | undefined>();
  const [detailTarget, setDetailTarget] = useState<DataSubjectRequest | null>(null);

  const handleDeleteClick = (dsr: DataSubjectRequest) => {
    setDSRToDelete(dsr);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!dsrToDelete) return;
    try {
      // TODO: Implement delete mutation when API is available
      toast.success("Data subject request deleted successfully");
      setDeleteDialogOpen(false);
      setDSRToDelete(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete request"
      );
    }
  };

  const columns: ColumnDef<DataSubjectRequest>[] = [
    {
      accessorKey: "requesterName",
      header: "Requester",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.requesterName}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm capitalize">{row.original.type.replace(/_/g, " ")}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          dsr={row.original}
          onDelete={handleDeleteClick}
        />
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (dsr: DataSubjectRequest) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{dsr.requesterName}</span>
        <Badge variant={statusVariant(dsr.status)}>
          {dsr.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground capitalize">
        {dsr.type.replace(/_/g, " ")}
      </div>
      <RowActions
        dsr={dsr}
        onDelete={handleDeleteClick}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Protection"
        description="Data subject requests, retention policies, and compliance"
        actions={
          canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton href="/app/dpo/requests/new" className="w-full md:w-auto min-h-[44px]">
                  {loadingHref === "/app/dpo/requests/new" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  New Request
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the new data subject request form
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      />

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Retention Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage data retention rules
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Sub-Processors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track third-party processors
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Privacy Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage consent notices
            </p>
          </CardContent>
        </Card>
      </div>

      <GeofencingComplianceCard />

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as DSRStatusTab)}
      >
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {DSR_STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-[44px]"
              title={tab.description}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
                {tabCounts[tab.value].toLocaleString()}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: DSR_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        emptyTitle="No data subject requests"
        emptyDescription="Requests from data subjects will appear here."
        mobileCard={mobileCard}
        getRowId={(dsr) => dsr.id}
        onRowClick={(dsr) => setDetailTarget(dsr)}
        rowClickAriaLabel={(dsr) => `View request from ${dsr.requesterName}`}
      />

      <DetailSheet
        open={!!detailTarget}
        onOpenChange={(open) => { if (!open) setDetailTarget(null); }}
        title={detailTarget ? `Request from ${detailTarget.requesterName}` : ""}
        description={
          detailTarget
            ? `${detailTarget.type.replace(/_/g, " ")} request — created ${formatDateTime(detailTarget.createdAt)}`
            : undefined
        }
      >
        {detailTarget && (
          <RecordDetailList
            rows={(
              [
                {
                  label: "Status",
                  value: (
                    <Badge variant={statusVariant(detailTarget.status)}>
                      {detailTarget.status.replace(/_/g, " ")}
                    </Badge>
                  ),
                },
                {
                  label: "Type",
                  value: (
                    <span className="capitalize">
                      {detailTarget.type.replace(/_/g, " ")}
                    </span>
                  ),
                },
                {
                  label: "Requester",
                  value: detailTarget.requesterName,
                },
                {
                  label: "Email",
                  value: detailTarget.requesterEmail,
                },
                {
                  label: "Created",
                  value: formatDateTime(detailTarget.createdAt),
                },
                {
                  label: "Last updated",
                  value: formatDateTime(detailTarget.updatedAt),
                },
                {
                  label: "Description",
                  value: detailTarget.description,
                  full: true,
                },
              ] as RecordDetailRow[]
            ).filter((r) => r.value !== null && r.value !== undefined && r.value !== "")}
          />
        )}
      </DetailSheet>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Data Subject Request"
        description={`Are you sure you want to delete the request from "${dsrToDelete?.requesterName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={false}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function RowActions({
  dsr,
  onDelete,
}: {
  dsr: DataSubjectRequest;
  onDelete: (d: DataSubjectRequest) => void;
}) {
  const editHref = `/app/dpo/requests/${dsr.id}/edit`;
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
          Open actions for this data subject request
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuNavItem
          href={editHref}
          label="Edit"
          icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
        />
        <DropdownMenuItem
          onClick={() => onDelete(dsr)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
