"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useJob } from "@/features/jobs/hooks";
import { JobStatusBadge } from "@/features/jobs/components";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import { formatTaskKey, parseJobError } from "@/lib/jobs";
import type { JobResourceSummary } from "@/types/job";

interface JobDetailViewProps {
  taskId: string;
  /** Where "Back to activity" should navigate, e.g. "/app/jobs" or "/admin/jobs" */
  listHref: string;
}

export function JobDetailView({ taskId, listHref }: JobDetailViewProps) {
  const { navigate } = useNavigationLoading();
  const [isBackLoading, setIsBackLoading] = useState(false);
  const { data: job, isLoading, isError, refetch, isFetching } = useJob(taskId);

  const handleBack = () => {
    setIsBackLoading(true);
    navigate(listHref);
  };

  if (isError || (!isLoading && !job)) {
    return (
      <div className="space-y-4">
        <BackLink isLoading={isBackLoading} onClick={handleBack} />
        <ErrorState
          title="Couldn't load this job"
          message="The job log may have been pruned, or your connection dropped."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading || !job) {
    return (
      <div className="space-y-4">
        <BackLink isLoading={isBackLoading} onClick={handleBack} />
        <PageHeader title="Job details" />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const isActive = job.status === "queued" || job.status === "processing";
  const parsedError = job.status === "failed" ? parseJobError(job) : null;

  return (
    <div className="space-y-4">
      <BackLink isLoading={isBackLoading} onClick={handleBack} />

      <PageHeader
        title={formatTaskKey(job.taskKey)}
        description={`Submitted ${formatRelative(job.dateCreated)} • Updated ${formatRelative(job.lastUpdated)}`}
        actions={
          <div className="flex items-center gap-2">
            <JobStatusBadge status={job.status} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="min-h-[44px] min-w-[44px]"
                  aria-label="Refresh job status"
                >
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh the job log from the server</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {isActive && (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-4 w-4 animate-spin text-info" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Still saving…</p>
              <p className="text-xs text-muted-foreground">
                A background worker is running this write. You&apos;ll get a
                notification if it fails.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {parsedError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">This write failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{parsedError}</p>
            <p className="text-xs text-muted-foreground">
              If this keeps happening, share the request id{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                {job.requestId ?? "—"}
              </code>{" "}
              with your admin so they can inspect the backend logs.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          <DetailRow label="Task id" value={job.taskId} mono />
          <DetailRow label="Task key" value={job.taskKey} mono />
          {job.id ? <DetailRow label="Log id" value={job.id} mono /> : null}
          <DetailRow
            label="Resource type"
            value={job.resourceType ?? "—"}
          />
          <DetailRow label="Resource id" value={job.resourceId ?? "—"} mono />
          <DetailRow label="Tenant id" value={job.tenantId ?? "—"} mono />
          <DetailRow label="Actor id" value={job.actorId ?? "—"} mono />
          <DetailRow label="Actor role" value={job.actorRole ?? "—"} />
          <DetailRow label="Request id" value={job.requestId ?? "—"} mono />
          <DetailRow
            label="Submitted"
            value={formatDateTime(job.dateCreated)}
          />
          <DetailRow
            label="Last update"
            value={formatDateTime(job.lastUpdated)}
          />
        </CardContent>
      </Card>

      {job.actorSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Triggered by</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            <DetailRow
              label="Full name"
              value={job.actorSummary.fullName ?? "—"}
            />
            <DetailRow
              label="Email"
              value={job.actorSummary.email ?? "—"}
            />
            <DetailRow
              label="Role"
              value={job.actorSummary.role ?? "—"}
            />
            <DetailRow
              label="User type"
              value={job.actorSummary.userType ?? "—"}
            />
            <DetailRow label="Actor id" value={job.actorSummary.id} mono />
          </CardContent>
        </Card>
      ) : null}

      {job.tenantSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            <DetailRow
              label="Name"
              value={job.tenantSummary.name ?? "—"}
            />
            <DetailRow
              label="Slug"
              value={job.tenantSummary.slug ?? "—"}
              mono
            />
            <DetailRow label="Tenant id" value={job.tenantSummary.id} mono />
          </CardContent>
        </Card>
      ) : null}

      {job.resourceSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resource</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            {renderResourceSummaryRows(job.resourceSummary)}
          </CardContent>
        </Card>
      ) : null}

      {job.result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BackLink({
  isLoading,
  onClick,
}: {
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2"
          onClick={onClick}
          disabled={isLoading}
          aria-label="Back to recent activity"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowLeft className="mr-2 h-4 w-4" />
          )}
          Back to activity
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Return to the list of recent background writes
      </TooltipContent>
    </Tooltip>
  );
}

// Shape varies by resource type, so render whichever fields came back. Keeps
// id last so the human-readable bits lead.
function renderResourceSummaryRows(summary: JobResourceSummary) {
  const rows: Array<{ label: string; value: string; mono?: boolean }> = [];

  if (summary.type) rows.push({ label: "Type", value: summary.type });
  if (summary.name) rows.push({ label: "Name", value: summary.name });
  if (summary.label) rows.push({ label: "Label", value: summary.label });
  if (summary.title) rows.push({ label: "Title", value: summary.title });
  if (summary.fullName)
    rows.push({ label: "Full name", value: summary.fullName });
  if (summary.email) rows.push({ label: "Email", value: summary.email });
  if (summary.code) rows.push({ label: "Code", value: summary.code, mono: true });
  if (summary.status) rows.push({ label: "Status", value: summary.status });
  rows.push({ label: "Resource id", value: summary.id, mono: true });

  return rows.map((row) => (
    <DetailRow
      key={row.label}
      label={row.label}
      value={row.value}
      mono={row.mono}
    />
  ));
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          mono
            ? "break-all text-sm font-mono"
            : "break-words text-sm"
        }
      >
        {value}
      </span>
    </div>
  );
}
