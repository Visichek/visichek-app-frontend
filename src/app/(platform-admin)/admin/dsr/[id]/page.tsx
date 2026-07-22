"use client";

import { use } from "react";
import {
  AlarmClock,
  ArrowLeft,
  Clock,
  Info,
  LifeBuoy,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import {
  RecordDetailList,
  type RecordDetailRow,
} from "@/components/recipes/record-detail-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { useAdminDSR } from "@/features/dsr/hooks/use-admin-dsr";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
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

export default function AdminDSRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = useAdminDSR(id);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Couldn't load this DSR"
        message="The request may have been deleted, or the id may be invalid."
        onRetry={() => refetch()}
      />
    );
  }

  const isClosed = data.status === "completed" || data.status === "rejected";
  const now = Math.floor(Date.now() / 1000);
  const slaSecondsLeft = data.slaDeadline ? data.slaDeadline - now : null;
  const breached = !isClosed && slaSecondsLeft !== null && slaSecondsLeft < 0;
  const atRisk =
    !isClosed &&
    slaSecondsLeft !== null &&
    slaSecondsLeft >= 0 &&
    slaSecondsLeft < 86_400;

  const supportCasesHref = `/admin/support-cases?tenantId=${data.tenantId}`;

  const rows: RecordDetailRow[] = [
    {
      label: "Status",
      value: (
        <Badge variant={statusVariant(data.status)}>
          {data.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      label: "Request type",
      value: (
        <span className="capitalize">{data.requestType.replace(/_/g, " ")}</span>
      ),
    },
    {
      label: "Organization id",
      value: (
        <span className="font-mono text-xs">{data.tenantId}</span>
      ),
    },
    {
      label: "Visitor profile id",
      value: data.visitorProfileId ? (
        <span className="font-mono text-xs">{data.visitorProfileId}</span>
      ) : undefined,
    },
    {
      label: "Identity verified",
      value: data.identityVerified ? (
        <Badge variant="success">
          <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
          Verified
        </Badge>
      ) : (
        <Badge variant="secondary">Unverified</Badge>
      ),
    },
    {
      label: "Received",
      value: data.receivedAt ? formatDateTime(data.receivedAt) : undefined,
    },
    {
      label: "Created",
      value: formatDateTime(data.dateCreated),
    },
    {
      label: "SLA deadline",
      value: data.slaDeadline ? (
        <span className="inline-flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {formatDateTime(data.slaDeadline)}
          <span className="text-xs text-muted-foreground">
            ({formatRelative(data.slaDeadline)})
          </span>
        </span>
      ) : undefined,
    },
    {
      label: "Notes",
      value: data.notes ?? undefined,
      full: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href="/admin/dsr" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/admin/dsr" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to DSRs
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the full data subject request list
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={`${data.requestType.replace(/_/g, " ")} request`}
        description="Read-only oversight view — DSR processing is the organization's legal responsibility."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={supportCasesHref}
                variant="outline"
                className="min-h-[44px]"
              >
                {loadingHref === supportCasesHref ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LifeBuoy className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Open support case
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Escalate this DSR by opening a support case against the organization — the
              right channel when the DSR is at-risk or breached
            </TooltipContent>
          </Tooltip>
        }
      />

      {/* SLA banner */}
      {breached && (
        <section className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">SLA deadline passed</p>
            <p className="text-muted-foreground">
              This DSR&apos;s legal window expired {formatRelative(data.slaDeadline!)}.
              Platform admins cannot process DSRs on the organization&apos;s behalf —
              escalate via a support case or contact the organization&apos;s DPO directly.
            </p>
          </div>
        </section>
      )}
      {atRisk && (
        <section className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlarmClock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">SLA deadline within 24 hours</p>
            <p className="text-muted-foreground">
              Deadline {formatRelative(data.slaDeadline!)}. Nudge the organization&apos;s
              DPO if there is no recent activity on this request.
            </p>
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request details</CardTitle>
        </CardHeader>
        <CardContent>
          <RecordDetailList rows={rows.filter((r) => r.value !== undefined)} />
        </CardContent>
      </Card>

      <section
        aria-label="Oversight scope notice"
        className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">Read-only oversight</p>
          <p className="text-muted-foreground">
            Platform admins can view but not acknowledge, complete, or reject DSRs
            — that authority sits with the organization&apos;s DPO or super admin to
            preserve the legal chain of custody. If escalation is required, open a
            support case or contact the organization directly.
          </p>
        </div>
      </section>
    </div>
  );
}
