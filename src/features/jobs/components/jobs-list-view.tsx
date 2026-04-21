"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { ErrorState } from "@/components/feedback/error-state";
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
import { Button } from "@/components/ui/button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useJobs } from "@/features/jobs/hooks";
import { JobStatusBadge } from "@/features/jobs/components";
import { formatRelative } from "@/lib/utils/format-date";
import { formatTaskKey, parseJobError } from "@/lib/jobs";
import type { JobRecord } from "@/types/job";
import type { JobStatus } from "@/types/enums";

type StatusFilter = JobStatus | "all";

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

export function JobsListView({ basePath }: JobsListViewProps) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const { loadingHref, handleNavClick } = useNavigationLoading();

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
                onClick={() => handleNavClick(href)}
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
            <TooltipContent>
              Filter the activity list by job status (queued, processing, succeeded, or failed)
            </TooltipContent>
          </Tooltip>
        }
      />

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
            onOpen={() => handleNavClick(`${basePath}/${job.taskId}`)}
          />
        )}
      />
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
