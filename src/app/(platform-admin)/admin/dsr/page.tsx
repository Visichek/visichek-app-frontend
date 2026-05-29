"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlarmClock,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { NavButton } from "@/components/recipes/nav-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import {
  useAdminDSRList,
  useAdminDSRStats,
  type AdminDSRListParams,
  type AdminDSRSort,
} from "@/features/dsr/hooks/use-admin-dsr";
import { useTenantList } from "@/features/auth/hooks/use-admin-dashboard";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import type { AdminDataSubjectRequest } from "@/types/dpo";
import type { DSRStatus, DSRType } from "@/types/enums";

type StatusFilter = DSRStatus | "all";
type TypeFilter = DSRType | "all";

const DSR_PAGE_SIZE = 25;
const DEFAULT_SORT: AdminDSRSort = "-date_created";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "access", label: "Access" },
  { value: "correction", label: "Correction" },
  { value: "deletion", label: "Deletion" },
  { value: "consent_withdrawal", label: "Consent withdrawal" },
];

const SORT_OPTIONS: { value: AdminDSRSort; label: string }[] = [
  { value: "-date_created", label: "Newest first" },
  { value: "date_created", label: "Oldest first" },
  { value: "sla_deadline", label: "SLA deadline (soonest)" },
  { value: "-sla_deadline", label: "SLA deadline (latest)" },
  { value: "status", label: "Status (A–Z)" },
];

function dateStringToEpoch(value: string, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59)
    : new Date(y, m - 1, d, 0, 0, 0);
  const ms = date.getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

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

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function AdminDSRPage() {
  const { loadingHref } = useNavigationLoading();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [tenantId, setTenantId] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sort, setSort] = useState<AdminDSRSort>(DEFAULT_SORT);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPageIndex(0);
  }, [q, status, type, tenantId, createdFrom, createdTo, sort]);

  const { data: tenantData } = useTenantList();
  const tenantOptions = useMemo(
    () =>
      (tenantData?.items ?? [])
        .map((t) => ({ value: t.id, label: t.companyName || t.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [tenantData],
  );

  const params: AdminDSRListParams = useMemo(
    () => ({
      q: q.length >= 2 ? q : undefined,
      status: status === "all" ? undefined : status,
      requestType: type === "all" ? undefined : type,
      tenantId: tenantId === "all" ? undefined : tenantId,
      createdAtGte: dateStringToEpoch(createdFrom),
      createdAtLte: dateStringToEpoch(createdTo, true),
      sort: sort === DEFAULT_SORT ? undefined : sort,
      skip: pageIndex * DSR_PAGE_SIZE,
      limit: DSR_PAGE_SIZE,
      facets: "status",
    }),
    [q, status, type, tenantId, createdFrom, createdTo, sort, pageIndex],
  );

  const { data, isLoading, isFetching, isError, refetch } = useAdminDSRList(params);
  const requests = data?.items ?? [];
  const meta = data?.meta;
  const { data: stats } = useAdminDSRStats();

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (q.length >= 2)
      chips.push({ key: "q", label: `Search: "${q}"`, clear: () => setSearchInput("") });
    if (status !== "all")
      chips.push({
        key: "status",
        label: `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`,
        clear: () => setStatus("all"),
      });
    if (type !== "all")
      chips.push({
        key: "type",
        label: `Type: ${TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type}`,
        clear: () => setType("all"),
      });
    if (tenantId !== "all")
      chips.push({
        key: "tenant",
        label: `Tenant: ${tenantOptions.find((o) => o.value === tenantId)?.label ?? tenantId}`,
        clear: () => setTenantId("all"),
      });
    if (createdFrom)
      chips.push({ key: "from", label: `From: ${createdFrom}`, clear: () => setCreatedFrom("") });
    if (createdTo)
      chips.push({ key: "to", label: `To: ${createdTo}`, clear: () => setCreatedTo("") });
    return chips;
  }, [q, status, type, tenantId, createdFrom, createdTo, tenantOptions]);

  const hasActiveFilters = activeChips.length > 0 || sort !== DEFAULT_SORT;

  function clearAll() {
    setSearchInput("");
    setStatus("all");
    setType("all");
    setTenantId("all");
    setCreatedFrom("");
    setCreatedTo("");
    setSort(DEFAULT_SORT);
  }

  const columns: ColumnDef<AdminDataSubjectRequest>[] = [
    {
      accessorKey: "requestType",
      header: "Type",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm capitalize">
          {row.original.requestType.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "tenantId",
      header: "Tenant",
      enableSorting: false,
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs text-muted-foreground">
              {truncateId(row.original.tenantId)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span className="font-mono text-xs">{row.original.tenantId}</span>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      id: "identityVerified",
      header: "Identity",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.identityVerified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="secondary">Unverified</Badge>
        ),
    },
    {
      accessorKey: "slaDeadline",
      header: "SLA deadline",
      enableSorting: false,
      cell: ({ row }) => <SlaCountdown deadline={row.original.slaDeadline} status={row.original.status} />,
    },
    {
      accessorKey: "dateCreated",
      header: "Received",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.receivedAt ?? row.original.dateCreated)}
        </span>
      ),
    },
  ];

  const mobileCard = (dsr: AdminDataSubjectRequest) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium capitalize">
            {dsr.requestType.replace(/_/g, " ")}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {truncateId(dsr.tenantId)}
          </p>
        </div>
        <Badge variant={statusVariant(dsr.status)}>
          {dsr.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SlaCountdown deadline={dsr.slaDeadline} status={dsr.status} />
        {dsr.identityVerified ? (
          <Badge variant="success">Identity verified</Badge>
        ) : (
          <Badge variant="secondary">Identity unverified</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Received {formatRelative(dsr.receivedAt ?? dsr.dateCreated)}
      </p>
    </div>
  );

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load data subject requests"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Subject Requests"
        description="Read-only oversight across every tenant — processing remains the tenant's legal responsibility."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href="/admin/dsr/sla-watch"
                variant="outline"
                className="min-h-[44px]"
              >
                {loadingHref === "/admin/dsr/sla-watch" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <AlarmClock className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                SLA watch
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Jump to DSRs whose SLA deadline falls in the next 24 hours, plus any already breached
            </TooltipContent>
          </Tooltip>
        }
      />

      {/* Stats tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Total DSRs"
          value={stats?.total}
          description="All requests across every tenant, regardless of status"
        />
        <StatTile
          label="Pending"
          value={stats?.byStatus?.pending}
          description="Requests waiting to be picked up by their tenant's DPO"
        />
        <StatTile
          label="SLA at risk"
          value={stats?.slaAtRisk}
          description="Open requests whose deadline lands in the next 24 hours"
          tone={stats?.slaAtRisk && stats.slaAtRisk > 0 ? "warning" : undefined}
        />
        <StatTile
          label="SLA breached"
          value={stats?.slaBreached}
          description="Open requests whose deadline has already passed"
          tone={stats?.slaBreached && stats.slaBreached > 0 ? "destructive" : undefined}
        />
      </div>

      {stats && stats.slaBreached > 0 && (
        <section
          aria-label="Breached SLA banner"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">
              {stats.slaBreached} request{stats.slaBreached === 1 ? "" : "s"} past their SLA deadline
            </p>
            <p className="text-muted-foreground">
              The tenant has missed the legal window. Escalate via a support case or
              contact the tenant&apos;s DPO directly — platform admins cannot process
              DSRs on the tenant&apos;s behalf.
            </p>
          </div>
        </section>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search DSR notes…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="min-h-[44px] pl-10 text-base md:text-sm"
          aria-label="Search data subject requests"
        />
        {isFetching && searchInput && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          id="dsr-status"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={STATUS_OPTIONS}
          tooltip="Filter by workflow status — e.g. show only pending or completed DSRs"
        />
        <FilterSelect
          id="dsr-type"
          label="Type"
          value={type}
          onChange={(v) => setType(v as TypeFilter)}
          options={TYPE_OPTIONS}
          tooltip="Filter by request type — access, correction, deletion, or consent withdrawal"
        />
        <FilterSelect
          id="dsr-tenant"
          label="Tenant"
          value={tenantId}
          onChange={setTenantId}
          options={[{ value: "all", label: "All tenants" }, ...tenantOptions]}
          tooltip="Show only DSRs raised against a single tenant"
        />
        <FilterSelect
          id="dsr-sort"
          label="Sort by"
          value={sort}
          onChange={(v) => setSort(v as AdminDSRSort)}
          options={SORT_OPTIONS}
          tooltip="Change the order requests are listed in"
        />
      </div>

      {/* Date range */}
      <div className="grid gap-3 md:grid-cols-2 lg:max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="created-from" className="text-xs font-medium text-muted-foreground">
            Created from
          </Label>
          <Input
            id="created-from"
            type="date"
            value={createdFrom}
            max={createdTo || undefined}
            onChange={(e) => setCreatedFrom(e.target.value)}
            className="min-h-[44px] text-base md:text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="created-to" className="text-xs font-medium text-muted-foreground">
            Created to
          </Label>
          <Input
            id="created-to"
            type="date"
            value={createdTo}
            min={createdFrom || undefined}
            onChange={(e) => setCreatedTo(e.target.value)}
            className="min-h-[44px] text-base md:text-sm"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[200px] truncate">{chip.label}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={chip.clear}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Remove this filter</TooltipContent>
              </Tooltip>
            </Badge>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-8 gap-1.5"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Clear all
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Reset search, every filter, and the sort order back to defaults
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        pagination
        serverPagination={{
          pageIndex,
          pageSize: DSR_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        mobileCard={mobileCard}
        emptyTitle="No data subject requests"
        emptyDescription="Requests created across the platform will appear here."
        getRowId={(d) => d.id}
        getRowHref={(d) => `/admin/dsr/${d.id}`}
        rowClickAriaLabel={(d) => `View DSR ${d.requestType} from tenant ${d.tenantId}`}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number | undefined;
  description: string;
  tone?: "warning" | "destructive";
}) {
  const toneClass =
    tone === "destructive"
      ? "border-destructive/40"
      : tone === "warning"
        ? "border-warning/40"
        : "";
  const valueClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className={toneClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${valueClass}`}>
              {typeof value === "number" ? value.toLocaleString() : "—"}
            </p>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="bottom">{description}</TooltipContent>
    </Tooltip>
  );
}

function SlaCountdown({
  deadline,
  status,
}: {
  deadline?: number;
  status: DSRStatus;
}) {
  if (!deadline) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const isClosed = status === "completed" || status === "rejected";
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = deadline - now;
  const hoursLeft = Math.floor(Math.abs(secondsLeft) / 3600);
  const overdue = !isClosed && secondsLeft < 0;
  const atRisk = !isClosed && !overdue && secondsLeft < 86_400;

  const className = overdue
    ? "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
    : atRisk
      ? "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning"
      : "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground";

  const label = isClosed
    ? formatDateTime(deadline)
    : overdue
      ? `Overdue by ${hoursLeft}h`
      : hoursLeft < 1
        ? "< 1h left"
        : hoursLeft < 24
          ? `${hoursLeft}h left`
          : `${Math.floor(hoursLeft / 24)}d left`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          <AlarmClock className="h-3 w-3" aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        SLA deadline {formatRelative(deadline)} — based on the tenant&apos;s
        regulatory window. Closed DSRs no longer count against the SLA.
      </TooltipContent>
    </Tooltip>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  tooltip,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  tooltip: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger id={id} className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
