"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  AlertTriangle,
  Edit2,
  Loader2,
  CheckCircle2,
  Search,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable, type DataTableBulkAction } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { NavButton } from "@/components/recipes/nav-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { DetailSheet } from "@/components/recipes/detail-sheet";
import { RecordDetailList, type RecordDetailRow } from "@/components/recipes/record-detail-list";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  useIncidents,
  useApproachingDeadlineIncidents,
  useBulkMarkIncidentsNotified,
} from "@/features/incidents/hooks/use-incidents";
import { IncidentRiskDot } from "@/features/incidents/components/incident-risk-dot";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { apiPatch } from "@/lib/api/request";
import { formatDateTime } from "@/lib/utils/format-date";
import { toast } from "sonner";
import type { Incident, UpdateIncidentRequest } from "@/types/incident";
import type { IncidentStatus } from "@/types/enums";

function statusVariant(status: IncidentStatus) {
  switch (status) {
    case "open":
      return "destructive" as const;
    case "investigating":
      return "warning" as const;
    case "contained":
      return "info" as const;
    case "reported_to_ndpc":
      return "secondary" as const;
    case "closed":
      return "success" as const;
  }
}

function formatType(type: string | null | undefined): string {
  if (!type) return "—";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function riskVariant(risk: string | null | undefined) {
  switch (risk) {
    case "critical":
      return "destructive" as const;
    case "high":
      return "warning" as const;
    case "medium":
      return "info" as const;
    case "low":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function incidentLabel(incident: Incident): string {
  return incident.description?.trim() || formatType(incident.incidentType) || "Incident";
}

const INCIDENTS_PAGE_SIZE = 25;
type IncidentStatusTab = "all" | "open" | "investigating" | "contained" | "reported_to_ndpc" | "closed";
const INCIDENT_TABS: { value: IncidentStatusTab; label: string; description: string }[] = [
  { value: "all", label: "All", description: "Show every incident regardless of status" },
  { value: "open", label: "Open", description: "Incidents that have just been reported and need triage" },
  { value: "investigating", label: "Investigating", description: "Incidents being actively investigated by the security team" },
  { value: "contained", label: "Contained", description: "Incidents where the immediate threat has been contained but a post-mortem is still in flight" },
  { value: "reported_to_ndpc", label: "Reported to NDPC", description: "Incidents that have been formally notified to the Nigeria Data Protection Commission" },
  { value: "closed", label: "Closed", description: "Incidents fully resolved with the investigation closed out" },
];

export default function IncidentsPage() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.INCIDENT_CREATE);
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [statusTab, setStatusTab] = useState<IncidentStatusTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  // Debounce the free-text search so each keystroke doesn't fire a request.
  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPageIndex(0);
  }, [statusTab, q]);

  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * INCIDENTS_PAGE_SIZE,
      limit: INCIDENTS_PAGE_SIZE,
      sort: "-dateCreated",
      facets: "status",
    };
    if (statusTab !== "all") params.status = statusTab;
    // Server-side search over description/summary (min 2 chars, matching the
    // backend INCIDENTS_LIST_SPEC). Replaces the old client-only page filter.
    if (q.length >= 2) params.q = q;
    return params;
  }, [pageIndex, statusTab, q]);

  const {
    data: incidentsResponse,
    isLoading,
    isFetching,
    refetch,
  } = useIncidents(listFilters);
  const { data: deadlineResponse } = useApproachingDeadlineIncidents();
  const bulkMarkNotified = useBulkMarkIncidentsNotified();

  const queryClient = useQueryClient();
  const markNotifiedMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateIncidentRequest;
    }) => apiPatch<Incident>(`/incidents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  const incidents = incidentsResponse?.items ?? [];
  const incidentsMeta = incidentsResponse?.meta;
  const statusFacet = incidentsMeta?.facets?.status ?? {};
  const tabCounts: Record<IncidentStatusTab, number> = {
    all: statusFacet.all ?? incidentsMeta?.total ?? 0,
    open: statusFacet.open ?? 0,
    investigating: statusFacet.investigating ?? 0,
    contained: statusFacet.contained ?? 0,
    reported_to_ndpc: statusFacet.reported_to_ndpc ?? 0,
    closed: statusFacet.closed ?? 0,
  };
  const deadlineIncidents = deadlineResponse?.items ?? [];

  const [pendingNotificationId, setPendingNotificationId] = useState<
    string | null
  >(null);
  const [bulkNotifyIds, setBulkNotifyIds] = useState<string[] | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Incident | null>(null);

  async function handleBulkMarkNotifiedConfirm() {
    if (!bulkNotifyIds || bulkNotifyIds.length === 0) return;
    setBulkPending(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = await bulkMarkNotified.mutateAsync({
        ids: bulkNotifyIds,
        notificationSentAt: now,
      });
      const { tone, message } = summarizeBulkResult(result, "incident", "marked as notified");
      toast[tone](message);
      setBulkNotifyIds(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk mark-notified failed");
    } finally {
      setBulkPending(false);
    }
  }

  const bulkActions: DataTableBulkAction<Incident>[] = [
    {
      label: "Mark as Notified",
      description: "Mark every selected incident as notified to NDPC with the current timestamp",
      icon: <CheckCircle2 className="h-4 w-4" />,
      variant: "default",
      onClick: (_ids, rows) => {
        const eligible = rows.filter((i) => !i.ndpcNotified).map((i) => i.id);
        if (eligible.length === 0) {
          toast.info("All selected incidents are already marked as notified");
          return;
        }
        setBulkNotifyIds(eligible);
      },
    },
  ];

  const handleMarkAsNotified = useCallback(
    (incident: Incident) => {
      setPendingNotificationId(incident.id);
      markNotifiedMutation.mutate(
        {
          id: incident.id,
          data: {
            ndpcNotified: true,
            notificationSentAt: Math.floor(Date.now() / 1000),
          },
        },
        {
          onSuccess: () => {
            toast.success("Incident marked as notified to NDPC");
            setPendingNotificationId(null);
            refetch();
          },
          onError: () => {
            toast.error("Failed to update incident");
            setPendingNotificationId(null);
          },
        },
      );
    },
    [markNotifiedMutation, refetch],
  );

  const columns: ColumnDef<Incident>[] = [
    {
      id: "summary",
      accessorFn: (row) => row.description ?? "",
      header: "Summary",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium">
            {incidentLabel(row.original)}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatType(row.original.incidentType)}
          </p>
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "riskLevel",
      header: "Risk",
      cell: ({ row }) => <IncidentRiskDot risk={row.original.riskLevel} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {(row.original.status ?? "").replace(/_/g, " ") || "—"}
        </Badge>
      ),
    },
    {
      id: "ndpc",
      header: "NDPC",
      cell: ({ row }) => <NdpcCell incident={row.original} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          incident={row.original}
          onMarkNotified={handleMarkAsNotified}
          pendingNotificationId={pendingNotificationId}
        />
      ),
    },
  ];

  const mobileCard = (incident: Incident) => {
    const editHref = `/app/incidents/${incident.id}/edit`;
    const isLoadingEdit = loadingHref === editHref;
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-2">{incidentLabel(incident)}</p>
            <p className="text-xs text-muted-foreground">
              {formatType(incident.incidentType)}
            </p>
          </div>
          <Badge variant={statusVariant(incident.status)}>
            {(incident.status ?? "").replace(/_/g, " ") || "—"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <IncidentRiskDot risk={incident.riskLevel} />
          <NdpcCell incident={incident} />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href={editHref} size="sm" variant="outline" className="w-full min-h-[44px]">
              {isLoadingEdit ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Edit2 className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              View / Edit
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="top">Open this incident&apos;s edit form</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Security incident tracking and response"
        actions={
          canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href="/app/incidents/new"
                  className="w-full md:w-auto min-h-[44px]"
                  data-tutorial-anchor="incidents-new-button"
                >
                  {loadingHref === "/app/incidents/new" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Report Incident
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the incident reporting form to log a new incident
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      />

      {deadlineIncidents.length > 0 && (
        <div
          data-tutorial-anchor="incidents-deadline-banner"
          className="rounded-lg border border-warning/50 bg-warning/10 p-4 flex items-start gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning">
              NDPC Notification Deadline Approaching
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {deadlineIncidents.length} incident
              {deadlineIncidents.length !== 1 ? "s" : ""}{" "}
              {deadlineIncidents.length !== 1 ? "are" : "is"} within 24 hours of
              the 72-hour NDPC notification deadline.
            </p>
            <ul className="mt-2 space-y-1">
              {deadlineIncidents.slice(0, 3).map((inc) => (
                <li key={inc.id} className="text-sm">
                  • <strong>{incidentLabel(inc)}</strong> — deadline:{" "}
                  {inc.notificationDeadline
                    ? formatDateTime(inc.notificationDeadline)
                    : "N/A"}
                </li>
              ))}
            </ul>
            {deadlineIncidents.length > 3 && (
              <p className="mt-1 text-sm text-muted-foreground">
                …and {deadlineIncidents.length - 3} more — see the list below.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search incidents by description…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="min-h-[44px] pl-10 text-base md:text-sm"
          aria-label="Search incidents"
        />
        {isFetching && searchInput && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as IncidentStatusTab)}
      >
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {INCIDENT_TABS.map((tab) => (
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
        data={incidents}
        isLoading={isLoading}
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: INCIDENTS_PAGE_SIZE,
          totalCount: incidentsMeta?.total ?? null,
          hasMore: incidentsMeta?.hasMore,
          onPageChange: setPageIndex,
        }}
        mobileCard={mobileCard}
        emptyTitle="No incidents found"
        emptyDescription="No incidents match your search or the selected status."
        selectable
        getRowId={(incident) => incident.id}
        itemNoun="incident"
        bulkActions={bulkActions}
        onRowClick={(incident) => setDetailTarget(incident)}
        rowClickAriaLabel={(incident) => `View details for ${incidentLabel(incident)}`}
      />

      <DetailSheet
        open={!!detailTarget}
        onOpenChange={(open) => { if (!open) setDetailTarget(null); }}
        title={detailTarget ? incidentLabel(detailTarget) : ""}
        description={
          detailTarget
            ? `Reported ${formatDateTime(detailTarget.dateCreated)}`
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
                  value: formatType(detailTarget.incidentType),
                },
                {
                  label: "Risk",
                  value: detailTarget.riskLevel ? (
                    <Badge variant={riskVariant(detailTarget.riskLevel)}>
                      {detailTarget.riskLevel}
                    </Badge>
                  ) : null,
                },
                {
                  label: "Branch",
                  value: detailTarget.branchSummary?.name ?? null,
                },
                {
                  label: "Detected",
                  value: detailTarget.detectionTime
                    ? formatDateTime(detailTarget.detectionTime)
                    : null,
                },
                {
                  label: "NDPC deadline",
                  value: detailTarget.notificationDeadline
                    ? formatDateTime(detailTarget.notificationDeadline)
                    : null,
                },
                {
                  label: "NDPC notified",
                  value: detailTarget.ndpcNotified
                    ? detailTarget.ndpcNotifiedAt
                      ? formatDateTime(detailTarget.ndpcNotifiedAt)
                      : "Yes"
                    : "No",
                },
                {
                  label: "Resolved",
                  value: detailTarget.resolvedAt
                    ? formatDateTime(detailTarget.resolvedAt)
                    : null,
                },
                {
                  label: "Description",
                  value: detailTarget.description,
                  full: true,
                },
                {
                  label: "Data affected",
                  value: detailTarget.dataAffected,
                  full: true,
                },
                {
                  label: "Mitigation",
                  value: detailTarget.mitigationSteps,
                  full: true,
                },
              ] as RecordDetailRow[]
            ).filter((r) => r.value !== null)}
          />
        )}
      </DetailSheet>

      <ConfirmDialog
        open={bulkNotifyIds !== null}
        onOpenChange={(open) => {
          if (!open) setBulkNotifyIds(null);
        }}
        title={`Mark ${bulkNotifyIds?.length ?? 0} incident${(bulkNotifyIds?.length ?? 0) === 1 ? "" : "s"} as notified`}
        description={`Record NDPC notification for ${bulkNotifyIds?.length ?? 0} incident${(bulkNotifyIds?.length ?? 0) === 1 ? "" : "s"} with the current timestamp.`}
        confirmLabel="Mark as Notified"
        isLoading={bulkPending}
        onConfirm={handleBulkMarkNotifiedConfirm}
      />
    </div>
  );
}

/**
 * Merges the NDPC deadline + notified status into one cell: a quiet "Notified"
 * once the regulator has been told, otherwise the 72-hour countdown — amber
 * within 24h, red once overdue. Keeps the compliance clock visible without a
 * second badge column competing with Status.
 */
function NdpcCell({ incident }: { incident: Incident }) {
  if (incident.ndpcNotified) {
    return (
      <span
        className="inline-flex items-center gap-1 text-sm text-success"
        title={
          incident.ndpcNotifiedAt
            ? `Notified to NDPC ${formatDateTime(incident.ndpcNotifiedAt)}`
            : "Notified to NDPC"
        }
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Notified
      </span>
    );
  }
  if (!incident.notificationDeadline) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const hoursRemaining = Math.floor(
    (incident.notificationDeadline * 1000 - Date.now()) / (1000 * 60 * 60),
  );
  const overdue = hoursRemaining <= 0;
  const urgent = !overdue && hoursRemaining < 24;
  return (
    <span
      className={`text-sm ${
        overdue
          ? "font-medium text-destructive"
          : urgent
            ? "font-medium text-warning"
            : "text-muted-foreground"
      }`}
      title={`NDPC deadline: ${formatDateTime(incident.notificationDeadline)}`}
    >
      {overdue ? "Overdue" : `Due in ${hoursRemaining}h`}
    </span>
  );
}

function RowActions({
  incident,
  onMarkNotified,
  pendingNotificationId,
}: {
  incident: Incident;
  onMarkNotified: (i: Incident) => void;
  pendingNotificationId: string | null;
}) {
  const editHref = `/app/incidents/${incident.id}/edit`;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          Open actions for this incident
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuNavItem
          href={editHref}
          label="View / Edit"
          icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
        />
        {!incident.ndpcNotified && (
          <DropdownMenuItem
            onClick={() => onMarkNotified(incident)}
            disabled={pendingNotificationId === incident.id}
          >
            {pendingNotificationId === incident.id
              ? "Marking..."
              : "Mark as Notified"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
