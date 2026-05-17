"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useJobs } from "@/features/jobs/hooks";
import { JobStatusBadge } from "@/features/jobs/components";
import { formatRelative } from "@/lib/utils/format-date";
import { formatTaskKey, parseJobError } from "@/lib/jobs";
import { cn } from "@/lib/utils/cn";
import type { JobRecord } from "@/types/job";
import type { JobStatus } from "@/types/enums";

type StatusFilter = JobStatus | "all";
type ViewMode = "grouped" | "all";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
];

interface JobsListViewProps {
  /** Base path the detail link lives under, e.g. "/app/jobs" or "/admin/jobs" */
  basePath: string;
}

interface JobGroup {
  taskKey: string;
  resourceType?: string;
  jobs: JobRecord[];
  total: number;
  counts: Record<JobStatus, number>;
  latest: JobRecord;
}

function groupJobs(jobs: JobRecord[]): JobGroup[] {
  const map = new Map<string, JobGroup>();

  for (const job of jobs) {
    const key = `${job.taskKey ?? "unknown"}|${job.resourceType ?? ""}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        taskKey: job.taskKey ?? "unknown",
        resourceType: job.resourceType ?? undefined,
        jobs: [job],
        total: 1,
        counts: {
          queued: 0,
          processing: 0,
          succeeded: 0,
          failed: 0,
          [job.status]: 1,
        } as Record<JobStatus, number>,
        latest: job,
      });
    } else {
      existing.jobs.push(job);
      existing.total += 1;
      existing.counts[job.status] = (existing.counts[job.status] ?? 0) + 1;
      if ((job.dateCreated ?? 0) > (existing.latest.dateCreated ?? 0)) {
        existing.latest = job;
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.latest.dateCreated ?? 0) - (a.latest.dateCreated ?? 0),
  );
}

export function JobsListView({ basePath }: JobsListViewProps) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("grouped");
  const { loadingHref, navigate } = useNavigationLoading();

  const params = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      start: 0,
      stop: 50,
    }),
    [status],
  );

  const { data: jobs, isLoading, isError, refetch } = useJobs(params);
  const rows = jobs ?? [];

  const groups = useMemo(() => groupJobs(rows), [rows]);

  const columns: ColumnDef<JobRecord>[] = [
    {
      accessorKey: "taskKey",
      header: "Action",
      cell: ({ row }) => (
        <span className="font-medium">{formatTaskKey(row.original.taskKey)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "resourceType",
      header: "Resource",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.resourceType ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "dateCreated",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatRelative(row.original.dateCreated)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const href = `${basePath}/${row.original.taskId}`;
        const isLoadingLink = loadingHref === href;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => navigate(href)}
                aria-label="View job details"
              >
                {isLoadingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Open the full job log to inspect the payload, result, and any errors
            </TooltipContent>
          </Tooltip>
        );
      },
    },
  ];

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Recent activity"
          description="Background writes you've triggered, newest first."
        />
        <ErrorState
          title="Couldn't load your recent activity"
          message="Your connection may have dropped. Try again in a moment."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recent activity"
        description="Background writes you've triggered. Failed jobs are also delivered to your notifications bell."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusFilter)}
                >
                  <SelectTrigger className="h-11 w-[180px]" aria-label="Filter jobs by status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              Filter the activity list by job status (queued, processing, succeeded, or failed)
            </TooltipContent>
          </Tooltip>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger
              value="grouped"
              title="Collapse repeated activity by action so you can scan distinct events"
            >
              Grouped by action
            </TabsTrigger>
            <TabsTrigger
              value="all"
              title="Show every individual event in chronological order"
            >
              All events
            </TabsTrigger>
          </TabsList>
          <div className="text-sm text-muted-foreground">
            {rows.length} event{rows.length !== 1 ? "s" : ""}
            {view === "grouped" && groups.length
              ? ` · ${groups.length} action${groups.length !== 1 ? "s" : ""}`
              : ""}
          </div>
        </div>
      </Tabs>

      {view === "grouped" ? (
        <GroupedJobsView
          groups={groups}
          isLoading={isLoading}
          basePath={basePath}
          loadingHref={loadingHref}
          navigate={navigate}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyTitle="No recent activity"
          emptyDescription="Writes you trigger from anywhere in the app will show up here."
          mobileCard={(job) => (
            <JobMobileCard
              job={job}
              isLoadingLink={loadingHref === `${basePath}/${job.taskId}`}
              onOpen={() => navigate(`${basePath}/${job.taskId}`)}
            />
          )}
          getRowId={(job) => job.taskId}
          getRowHref={(job) => `${basePath}/${job.taskId}`}
          rowClickAriaLabel={(job) =>
            `View details for job ${job.taskKey} (${job.taskId.slice(0, 8)})`
          }
        />
      )}
    </div>
  );
}

function GroupedJobsView({
  groups,
  isLoading,
  basePath,
  loadingHref,
  navigate,
}: {
  groups: JobGroup[];
  isLoading: boolean;
  basePath: string;
  loadingHref: string | null;
  navigate: (href: string) => void;
}) {
  if (isLoading) {
    return <TableSkeleton rows={5} columns={4} />;
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No recent activity"
        description="Writes you trigger from anywhere in the app will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <JobGroupRow
          key={`${group.taskKey}|${group.resourceType ?? ""}`}
          group={group}
          basePath={basePath}
          loadingHref={loadingHref}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

function JobGroupRow({
  group,
  basePath,
  loadingHref,
  navigate,
}: {
  group: JobGroup;
  basePath: string;
  loadingHref: string | null;
  navigate: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const failed = group.counts.failed ?? 0;
  const succeeded = group.counts.succeeded ?? 0;
  const inFlight = (group.counts.queued ?? 0) + (group.counts.processing ?? 0);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        failed > 0 && "border-destructive/40",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40 min-h-[44px]"
          >
            <span className="shrink-0 text-muted-foreground">
              {open ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{formatTaskKey(group.taskKey)}</span>
                <Badge variant="secondary">
                  {group.total} event{group.total !== 1 ? "s" : ""}
                </Badge>
                {group.resourceType && (
                  <span className="text-xs text-muted-foreground">
                    {group.resourceType}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Last {formatRelative(group.latest.dateCreated)}</span>
                {succeeded > 0 && (
                  <Badge variant="success" className="font-normal">
                    {succeeded} succeeded
                  </Badge>
                )}
                {inFlight > 0 && (
                  <Badge variant="info" className="font-normal">
                    {inFlight} in flight
                  </Badge>
                )}
                {failed > 0 && (
                  <Badge variant="destructive" className="font-normal">
                    {failed} failed
                  </Badge>
                )}
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {open
            ? "Collapse this group"
            : "Expand to see every event in this group"}
        </TooltipContent>
      </Tooltip>

      {open && (
        <ul className="divide-y border-t">
          {group.jobs.map((job) => {
            const href = `${basePath}/${job.taskId}`;
            const isLoadingLink = loadingHref === href;
            return (
              <li key={job.taskId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <JobStatusBadge status={job.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(job.dateCreated)}
                    </span>
                  </div>
                  {job.status === "failed" && job.error && (
                    <p className="text-xs text-destructive line-clamp-2">
                      {parseJobError(job)}
                    </p>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => navigate(href)}
                      aria-label="View job details"
                    >
                      {isLoadingLink ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Open the full job log to inspect the payload, result, and any errors
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function JobMobileCard({
  job,
  isLoadingLink,
  onOpen,
}: {
  job: JobRecord;
  isLoadingLink: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 min-h-[44px]"
    >
      <div className="mt-0.5 shrink-0">
        {isLoadingLink ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Activity className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {formatTaskKey(job.taskKey)}
          </span>
          <JobStatusBadge status={job.status} />
        </div>
        {job.status === "failed" && job.error && (
          <p className="text-xs text-destructive line-clamp-2">
            {parseJobError(job)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatRelative(job.dateCreated)}
        </p>
      </div>
    </button>
  );
}
