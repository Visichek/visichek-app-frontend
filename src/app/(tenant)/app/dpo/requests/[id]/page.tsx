"use client";

import { use } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Clock,
  FileDown,
  Loader2,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

import { NavButton } from "@/components/recipes/nav-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RecordDetailList,
  type RecordDetailRow,
} from "@/components/recipes/record-detail-list";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import { useDataSubjectRequest } from "@/features/dsr/hooks/use-dsr";
import { DSRFulfilmentPanel } from "@/features/dsr/components/dsr-fulfilment-panel";
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

function subjectName(dsr: DataSubjectRequest): string {
  return (
    dsr.visitorProfileSummary?.fullName || dsr.requesterName || "Unknown visitor"
  );
}

function requestTypeLabel(dsr: DataSubjectRequest): string {
  return (dsr.requestType ?? dsr.type ?? "").replace(/_/g, " ");
}

/** Returns the SLA badge variant + label, or null when there's no/closed SLA. */
function slaState(
  dsr: DataSubjectRequest,
): { variant: "success" | "warning" | "destructive"; label: string } | null {
  if (!dsr.slaDeadline) return null;
  const closed = dsr.status === "completed" || dsr.status === "rejected";
  const nowSec = Math.floor(Date.now() / 1000);
  if (closed) {
    return { variant: "success", label: formatDateTime(dsr.slaDeadline) };
  }
  if (nowSec > dsr.slaDeadline) {
    return { variant: "destructive", label: `Breached ${formatRelative(dsr.slaDeadline)}` };
  }
  if (dsr.slaDeadline - nowSec <= 86400) {
    return { variant: "warning", label: `Due ${formatRelative(dsr.slaDeadline)}` };
  }
  return { variant: "success", label: `Due ${formatRelative(dsr.slaDeadline)}` };
}

export default function DSRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref } = useNavigationLoading();
  const { data: dsr, isLoading, isError, refetch } = useDataSubjectRequest(id);

  const backButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavButton
          href={PATHS.APP_DPO}
          variant="ghost"
          size="sm"
          className="min-h-[44px] px-2"
        >
          {loadingHref === PATHS.APP_DPO ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Data protection
        </NavButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Return to the data protection workspace
      </TooltipContent>
    </Tooltip>
  );

  if (isError || (!isLoading && !dsr)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {backButton}
        <ErrorState
          title="Couldn't load this request"
          message="It may have been deleted, or your connection dropped."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading || !dsr) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const sla = slaState(dsr);
  const summary = dsr.visitorProfileSummary;

  const detailRows: RecordDetailRow[] = (
    [
      {
        label: "Type",
        value: <span className="capitalize">{requestTypeLabel(dsr)}</span>,
      },
      {
        label: "Status",
        value: (
          <Badge variant={statusVariant(dsr.status)}>
            {dsr.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        label: "Identity",
        value: dsr.identityVerified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Unverified</Badge>
        ),
      },
      {
        label: "SLA deadline",
        value: sla ? <Badge variant={sla.variant}>{sla.label}</Badge> : undefined,
      },
      { label: "Submitted", value: formatDateTime(dsr.dateCreated ?? dsr.createdAt) },
      {
        label: "Received",
        value: dsr.receivedAt ? formatDateTime(dsr.receivedAt) : undefined,
      },
      {
        label: "Resolved",
        value: dsr.resolvedAt ? formatDateTime(dsr.resolvedAt) : undefined,
      },
      {
        label: "Handled by",
        value: dsr.adminSummary?.fullName ?? dsr.adminSummary?.email,
      },
      {
        label: "Linked visit",
        value: dsr.visitSessionSummary
          ? `${dsr.visitSessionSummary.visitorNameSnapshot ?? "Session"}${
              dsr.visitSessionSummary.checkInTime
                ? ` · ${formatDateTime(dsr.visitSessionSummary.checkInTime)}`
                : ""
            }`
          : undefined,
      },
    ] as RecordDetailRow[]
  ).filter((r) => r.value !== null && r.value !== undefined && r.value !== "");

  const hasOutcome =
    !!dsr.resolution ||
    !!dsr.rejectionReason ||
    !!dsr.notes ||
    !!dsr.accessExportGeneratedAt;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {backButton}

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {subjectName(dsr)}
            </h1>
            <Badge variant={statusVariant(dsr.status)}>
              {dsr.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm capitalize text-muted-foreground">
            {requestTypeLabel(dsr)} request · submitted{" "}
            {formatDateTime(dsr.dateCreated ?? dsr.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Subject */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Data subject</CardTitle>
            </CardHeader>
            <CardContent>
              {summary ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailLine
                    icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
                    label="Name"
                    value={summary.fullName}
                  />
                  <DetailLine
                    icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    label="Email"
                    value={summary.emailAddress}
                  />
                  <DetailLine
                    icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                    label="Phone"
                    value={summary.phone}
                  />
                  <DetailLine
                    icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                    label="Company"
                    value={summary.company}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No visitor profile is linked to this request.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Request details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Request details</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordDetailList rows={detailRows} />
            </CardContent>
          </Card>

          {/* Outcome */}
          {hasOutcome && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Outcome</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {dsr.resolution && (
                  <Field label="Resolution">{dsr.resolution}</Field>
                )}
                {dsr.rejectionReason && (
                  <Field label="Rejection reason">{dsr.rejectionReason}</Field>
                )}
                {(dsr.notes || dsr.description) && (
                  <Field label="Notes">{dsr.notes ?? dsr.description}</Field>
                )}
                {dsr.accessExportGeneratedAt && (
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                    <FileDown
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        Data export delivered
                      </p>
                      <p className="text-muted-foreground">
                        Emailed to{" "}
                        <span className="text-foreground">
                          {dsr.accessExportEmailedTo}
                        </span>{" "}
                        on {formatDateTime(dsr.accessExportGeneratedAt)}.
                      </p>
                      {dsr.accessExportExpiresAt && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          Secure link expires{" "}
                          {formatDateTime(dsr.accessExportExpiresAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Aside — fulfilment */}
        <div className="space-y-6">
          <DSRFulfilmentPanel dsr={dsr} />
          {sla && (
            <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Legal SLA: <span className="text-foreground">{sla.label}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm text-foreground">
          {value || <span className="text-muted-foreground">—</span>}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-foreground">{children}</p>
    </div>
  );
}
