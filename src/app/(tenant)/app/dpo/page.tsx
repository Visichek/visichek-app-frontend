"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, PlayCircle, ShieldOff, FileText, XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { NavButton } from "@/components/recipes/nav-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/format-date";
import {
  useBulkDSRAction,
  useDataSubjectRequests,
} from "@/features/dsr/hooks/use-dsr";
import { DSRRowActions } from "@/features/dsr/components/dsr-row-actions";
import { ScheduledErasuresSheet } from "@/features/dsr/components/scheduled-erasures-sheet";
import { GeofencingComplianceCard } from "@/features/dpo/components/geofencing-compliance-card";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { PATHS } from "@/lib/routing/paths";
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

/** The DSR carries no requester name; show the linked visitor's snapshot. */
function subjectName(dsr: DataSubjectRequest): string {
  return dsr.visitorProfileSummary?.fullName || dsr.requesterName || "Unknown visitor";
}

/** Backend emits `requestType`; tolerate the legacy `type` defensively. */
function requestTypeLabel(dsr: DataSubjectRequest): string {
  return (dsr.requestType ?? dsr.type ?? "").replace(/_/g, " ");
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
  const canEdit = hasCapability(CAPABILITIES.DSR_EDIT);
  const canErase = hasCapability(CAPABILITIES.VISITOR_ERASE);
  const canViewPrivacyNotices = hasCapability(CAPABILITIES.PRIVACY_NOTICE_VIEW);
  const { loadingHref } = useNavigationLoading();

  const [statusTab, setStatusTab] = useState<DSRStatusTab>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [erasuresOpen, setErasuresOpen] = useState(false);

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

  const bulkAcknowledge = useBulkDSRAction("acknowledge");
  const bulkReject = useBulkDSRAction("reject");

  async function handleBulkAcknowledge(ids: string[]) {
    try {
      const result = await bulkAcknowledge.mutateAsync({ ids });
      const { tone, message } = summarizeBulkResult(result, "request", "acknowledged");
      toast[tone](message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge requests");
    }
  }

  async function handleBulkReject(ids: string[]) {
    try {
      const result = await bulkReject.mutateAsync({ ids });
      const { tone, message } = summarizeBulkResult(result, "request", "rejected");
      toast[tone](message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject requests");
    }
  }

  const bulkActions = canEdit
    ? [
        {
          label: "Acknowledge",
          description: "Mark the selected requests as in progress",
          icon: <PlayCircle className="h-4 w-4" aria-hidden="true" />,
          variant: "default" as const,
          isLoading: bulkAcknowledge.isPending,
          onClick: (ids: string[]) => handleBulkAcknowledge(ids),
        },
        {
          label: "Reject",
          description: "Reject the selected requests",
          icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
          variant: "destructive" as const,
          isLoading: bulkReject.isPending,
          onClick: (ids: string[]) => handleBulkReject(ids),
        },
      ]
    : undefined;

  const columns: ColumnDef<DataSubjectRequest>[] = [
    {
      id: "subject",
      header: "Visitor",
      cell: ({ row }) => {
        const email = row.original.visitorProfileSummary?.emailAddress;
        return (
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {subjectName(row.original)}
            </span>
            {email && (
              <span className="block truncate text-xs text-muted-foreground">
                {email}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm capitalize">{requestTypeLabel(row.original)}</span>
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
      id: "identity",
      header: "Identity",
      cell: ({ row }) =>
        row.original.identityVerified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Unverified</Badge>
        ),
    },
    {
      id: "submitted",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.dateCreated ?? row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <DSRRowActions dsr={row.original} />,
      enableHiding: false,
    },
  ];

  const mobileCard = (dsr: DataSubjectRequest) => (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{subjectName(dsr)}</span>
        <Badge variant={statusVariant(dsr.status)}>
          {dsr.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-sm capitalize text-muted-foreground">
        {requestTypeLabel(dsr)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatDateTime(dsr.dateCreated ?? dsr.createdAt)}
        </span>
        <DSRRowActions dsr={dsr} />
      </div>
    </div>
  );

  const showUtilityBar = canErase || canViewPrivacyNotices;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Protection"
        description="Manage data subject requests and visitor data erasure"
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

      {/* Compact utility bar — keeps the table the focus of the page. */}
      {showUtilityBar && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
          {canErase && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setErasuresOpen(true)}
                  className="min-h-[44px] justify-start"
                >
                  <ShieldOff className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Scheduled erasures
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Review and restore visitor profiles soft-deleted by an erasure
                request before their grace window closes
              </TooltipContent>
            </Tooltip>
          )}
          {canViewPrivacyNotices && (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href={PATHS.APP_DPO_PRIVACY_NOTICES}
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] justify-start"
                >
                  {loadingHref === PATHS.APP_DPO_PRIVACY_NOTICES ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  Privacy notices
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                View the privacy notice visitors see at check-in
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

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
        selectable={canEdit}
        getRowId={(dsr) => dsr.id}
        itemNoun="requests"
        bulkActions={bulkActions}
        emptyTitle="No data subject requests"
        emptyDescription="Requests from data subjects will appear here."
        mobileCard={mobileCard}
        getRowHref={(dsr) => `/app/dpo/requests/${dsr.id}`}
        rowClickAriaLabel={(dsr) => `View request from ${subjectName(dsr)}`}
      />

      {/* Geofencing compliance status — a footnote panel below the workspace
          so it informs without crowding the request list. */}
      <GeofencingComplianceCard />

      <ScheduledErasuresSheet open={erasuresOpen} onOpenChange={setErasuresOpen} />
    </div>
  );
}
