"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Search, Building2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { DetailSheet } from "@/components/recipes/detail-sheet";
import {
  RecordDetailList,
  type RecordDetailRow,
} from "@/components/recipes/record-detail-list";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncidentRiskDot } from "@/features/incidents/components/incident-risk-dot";
import {
  useAdminIncidents,
  type AdminIncident,
} from "@/features/incidents/hooks/use-incidents";
import { formatDateTime } from "@/lib/utils/format-date";
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
    default:
      return "secondary" as const;
  }
}

function riskVariant(risk: string | null | undefined) {
  switch (risk) {
    case "critical":
      return "destructive" as const;
    case "high":
      return "warning" as const;
    case "medium":
      return "info" as const;
    default:
      return "secondary" as const;
  }
}

function formatType(type: string | null | undefined): string {
  if (!type) return "—";
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function incidentLabel(incident: AdminIncident): string {
  return incident.description?.trim() || formatType(incident.incidentType) || "Incident";
}

const PAGE_SIZE = 25;
type StatusTab =
  | "all"
  | "open"
  | "investigating"
  | "contained"
  | "reported_to_ndpc"
  | "closed";

const TABS: { value: StatusTab; label: string; description: string }[] = [
  { value: "all", label: "All", description: "Every incident across all tenants" },
  { value: "open", label: "Open", description: "Newly reported, awaiting triage" },
  { value: "investigating", label: "Investigating", description: "Under active investigation" },
  { value: "contained", label: "Contained", description: "Threat contained, post-mortem in flight" },
  { value: "reported_to_ndpc", label: "Reported to NDPC", description: "Formally notified to the regulator" },
  { value: "closed", label: "Closed", description: "Fully resolved and closed out" },
];

function NdpcCell({ incident }: { incident: AdminIncident }) {
  if (incident.ndpcNotified) {
    return <span className="text-sm text-success">Notified</span>;
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

export default function AdminIncidentsPage() {
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [detailTarget, setDetailTarget] = useState<AdminIncident | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPageIndex(0);
  }, [statusTab, q]);

  const filters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort: "-dateCreated",
      facets: "status",
    };
    if (statusTab !== "all") params.status = statusTab;
    if (q.length >= 2) params.q = q;
    return params;
  }, [pageIndex, statusTab, q]);

  const { data, isLoading, isFetching } = useAdminIncidents(filters);
  const incidents = data?.items ?? [];
  const meta = data?.meta;
  const statusFacet = (meta?.facets?.status ?? {}) as Record<string, number>;
  const tabCounts: Record<StatusTab, number> = {
    all: statusFacet.all ?? meta?.total ?? 0,
    open: statusFacet.open ?? 0,
    investigating: statusFacet.investigating ?? 0,
    contained: statusFacet.contained ?? 0,
    reported_to_ndpc: statusFacet.reported_to_ndpc ?? 0,
    closed: statusFacet.closed ?? 0,
  };

  const columns: ColumnDef<AdminIncident>[] = [
    {
      id: "tenant",
      header: "Tenant",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-sm font-medium">
            {row.original.tenantSummary?.name ?? "Unknown tenant"}
          </span>
        </div>
      ),
    },
    {
      id: "summary",
      header: "Summary",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm">{incidentLabel(row.original)}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatType(row.original.incidentType)}
          </p>
        </div>
      ),
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
      id: "reported",
      header: "Reported",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.dateCreated)}
        </span>
      ),
    },
  ];

  const mobileCard = (incident: AdminIncident) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-sm font-medium">
          {incident.tenantSummary?.name ?? "Unknown tenant"}
        </span>
      </div>
      <p className="text-sm line-clamp-2">{incidentLabel(incident)}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <IncidentRiskDot risk={incident.riskLevel} />
        <Badge variant={statusVariant(incident.status)}>
          {(incident.status ?? "").replace(/_/g, " ") || "—"}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <NdpcCell incident={incident} />
        <span>{formatDateTime(incident.dateCreated)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Security and data-protection incidents reported across every tenant."
      />

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

      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {TABS.map((tab) => (
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
        pagination
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        mobileCard={mobileCard}
        emptyTitle="No incidents found"
        emptyDescription="No incidents match your search or the selected status."
        onRowClick={(incident) => setDetailTarget(incident)}
        rowClickAriaLabel={(incident) =>
          `View details for ${incidentLabel(incident)}`
        }
      />

      <DetailSheet
        open={!!detailTarget}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
        title={detailTarget ? incidentLabel(detailTarget) : ""}
        description={
          detailTarget
            ? `${detailTarget.tenantSummary?.name ?? "Unknown tenant"} · reported ${formatDateTime(detailTarget.dateCreated)}`
            : undefined
        }
      >
        {detailTarget && (
          <RecordDetailList
            rows={(
              [
                {
                  label: "Tenant",
                  value: detailTarget.tenantSummary?.name ?? null,
                },
                {
                  label: "Status",
                  value: (
                    <Badge variant={statusVariant(detailTarget.status)}>
                      {detailTarget.status.replace(/_/g, " ")}
                    </Badge>
                  ),
                },
                { label: "Type", value: formatType(detailTarget.incidentType) },
                {
                  label: "Risk",
                  value: detailTarget.riskLevel ? (
                    <Badge variant={riskVariant(detailTarget.riskLevel)}>
                      {detailTarget.riskLevel}
                    </Badge>
                  ) : null,
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
    </div>
  );
}
