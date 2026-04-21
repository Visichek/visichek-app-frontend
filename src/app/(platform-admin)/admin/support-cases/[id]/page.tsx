"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  PlayCircle,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useAdminSupportCase,
  useAdminSupportCaseMessages,
  useAdminReplySupportCase,
  useAdminTransition,
  useAssignAdmin,
} from "@/features/support-cases/hooks/use-admin-support-cases";
import {
  CaseStatusBadge,
  CasePriorityBadge,
  CaseCategoryBadge,
  SupportTierBadge,
  CaseMessageThread,
  ReplyComposer,
} from "@/features/support-cases/components";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import type {
  SupportCaseStatus,
} from "@/types/enums";

/**
 * Admin-legal state-machine transitions.
 * `resolved → closed` is driven by the tenant (confirm resolution), not here.
 * `* → reopened` is also tenant-driven via the reopen endpoint.
 */
const ADMIN_TRANSITIONS: Record<
  SupportCaseStatus,
  { to: SupportCaseStatus; label: string; hint: string; icon: typeof PlayCircle }[]
> = {
  open: [
    {
      to: "acknowledged",
      label: "Acknowledge",
      hint: "Let the tenant know we've seen the case and will be picking it up shortly",
      icon: CheckCircle2,
    },
  ],
  acknowledged: [
    {
      to: "in_progress",
      label: "Start working",
      hint: "Move the case into active investigation — visible to the tenant",
      icon: PlayCircle,
    },
  ],
  in_progress: [
    {
      to: "awaiting_tenant",
      label: "Ask tenant",
      hint: "Pause progress while we wait for the tenant to respond with more information",
      icon: Hourglass,
    },
    {
      to: "resolved",
      label: "Mark resolved",
      hint: "We've fixed the issue — the tenant can confirm or reopen",
      icon: CheckCircle2,
    },
  ],
  awaiting_tenant: [
    {
      to: "in_progress",
      label: "Resume",
      hint: "Tenant replied — return the case to active work",
      icon: PlayCircle,
    },
  ],
  reopened: [
    {
      to: "in_progress",
      label: "Pick back up",
      hint: "Tenant reopened — move the case back into active work",
      icon: PlayCircle,
    },
  ],
  resolved: [],
  closed: [],
};

export default function AdminSupportCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const { data: detail, isLoading, isError, refetch } = useAdminSupportCase(caseId);
  const { data: messages } = useAdminSupportCaseMessages(caseId, !!detail);
  const replyMutation = useAdminReplySupportCase(caseId);
  const transitionMutation = useAdminTransition(caseId);
  const assignMutation = useAssignAdmin(caseId);

  if (isError || (!isLoading && !detail)) {
    return (
      <div className="space-y-4">
        <BackLink loadingHref={loadingHref} handleNavClick={handleNavClick} />
        <ErrorState
          title="Couldn't load this case"
          message="The case may have been closed, or your connection dropped."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="space-y-6">
        <BackLink loadingHref={loadingHref} handleNavClick={handleNavClick} />
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="space-y-3">
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  const { case: supportCase } = detail;
  const threadMessages = messages ?? detail.messages;
  const status = supportCase.status;
  const transitions = ADMIN_TRANSITIONS[status] ?? [];
  const isClosed = status === "closed";

  const handleReply = async ({
    body,
    attachments,
    internalNote,
  }: {
    body: string;
    attachments: { objectKey: string; fileName: string; mimeType: string; size: number }[];
    internalNote?: boolean;
  }) => {
    try {
      await replyMutation.mutateAsync({
        body,
        attachments,
        internalNote: internalNote ?? false,
      });
      toast.success(internalNote ? "Internal note saved" : "Reply sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reply");
    }
  };

  const handleTransition = async (to: SupportCaseStatus) => {
    try {
      await transitionMutation.mutateAsync({ status: to });
      toast.success("Status updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update the case status",
      );
    }
  };

  return (
    <div className="space-y-6">
      <BackLink loadingHref={loadingHref} handleNavClick={handleNavClick} />

      <PageHeader
        title={supportCase.subject}
        description={`Opened ${formatRelative(supportCase.dateCreated)} · ${formatDateTime(
          supportCase.dateCreated,
        )}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <CaseStatusBadge status={status} />
        <CasePriorityBadge priority={supportCase.priority} />
        <CaseCategoryBadge category={supportCase.category} />
        {supportCase.supportTier && <SupportTierBadge tier={supportCase.supportTier} />}
        {supportCase.slaDueAt && !isClosed && status !== "resolved" && (
          <SlaChip slaDueAt={supportCase.slaDueAt} />
        )}
      </div>

      <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
        <div>
          <span className="font-medium text-foreground">Tenant:</span>{" "}
          <span className="font-mono text-xs">{supportCase.tenantId}</span>
        </div>
        <div>
          <span className="font-medium text-foreground">Opened by:</span>{" "}
          <span className="font-mono text-xs">{supportCase.openedBy}</span>{" "}
          <span className="text-xs">({supportCase.openedByRole})</span>
        </div>
        <div>
          <span className="font-medium text-foreground">Assigned admin:</span>{" "}
          {supportCase.assignedAdminId ? (
            <span className="font-mono text-xs">{supportCase.assignedAdminId}</span>
          ) : (
            <span className="italic">Unassigned</span>
          )}
        </div>
        <div>
          <span className="font-medium text-foreground">Last activity:</span>{" "}
          {formatRelative(supportCase.lastMessageAt ?? supportCase.lastUpdated)}
        </div>
      </div>

      {/* Original description */}
      <section
        aria-label="Original issue"
        className="rounded-lg border border-border bg-muted/30 p-4"
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-semibold">Original request</span>
          <span>{formatDateTime(supportCase.dateCreated)}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{supportCase.description}</p>
      </section>

      {/* State machine + assign */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-label="Workflow actions"
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <h2 className="text-base font-semibold">Workflow</h2>
          {transitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isClosed
                ? "This case is closed. The tenant can reopen it to continue."
                : status === "resolved"
                  ? "Waiting for the tenant to confirm resolution or reopen the case."
                  : "No admin transitions available from this state."}
            </p>
          ) : (
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              {transitions.map((t) => {
                const Icon = t.icon;
                const isPending =
                  transitionMutation.isPending &&
                  transitionMutation.variables?.status === t.to;
                return (
                  <Tooltip key={t.to}>
                    <TooltipTrigger asChild>
                      <span>
                        <LoadingButton
                          variant={t.to === "resolved" ? "default" : "outline"}
                          onClick={() => handleTransition(t.to)}
                          isLoading={isPending}
                          loadingText="Updating…"
                          disabled={transitionMutation.isPending}
                          className="w-full md:w-auto"
                        >
                          <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t.label}
                        </LoadingButton>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t.hint}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </section>

        <AssignAdminCard
          currentAssignedId={supportCase.assignedAdminId ?? null}
          isPending={assignMutation.isPending}
          onAssign={async (adminId) => {
            try {
              await assignMutation.mutateAsync({ adminId });
              toast.success("Assigned admin updated");
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Couldn't update the assignment",
              );
            }
          }}
        />
      </div>

      {/* Thread — with internal notes visible to admins */}
      <section aria-label="Conversation" className="space-y-2">
        <h2 className="text-base font-semibold">Conversation</h2>
        <CaseMessageThread messages={threadMessages} showInternalNotes />
      </section>

      {/* Reply composer with internal-note toggle */}
      <section aria-label="Reply" className="space-y-2">
        <h2 className="text-base font-semibold">Reply</h2>
        <ReplyComposer
          caseId={caseId}
          onSubmit={handleReply}
          isSubmitting={replyMutation.isPending}
          disabled={isClosed}
          disabledReason="This case is closed. The tenant needs to reopen it first."
          allowInternalNote
          placeholder="Write a reply to the tenant, or check 'Internal note' to log admin-only context…"
        />
      </section>
    </div>
  );
}

function AssignAdminCard({
  currentAssignedId,
  isPending,
  onAssign,
}: {
  currentAssignedId: string | null;
  isPending: boolean;
  onAssign: (adminId: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    await onAssign(trimmed);
    setValue("");
  };

  return (
    <section
      aria-label="Assign admin"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold">Assign admin</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Currently assigned:{" "}
        {currentAssignedId ? (
          <span className="font-mono text-xs text-foreground">{currentAssignedId}</span>
        ) : (
          <span className="italic">Nobody</span>
        )}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 md:flex-row">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="assign-admin-id" className="sr-only">
            Admin user ID
          </Label>
          <Input
            id="assign-admin-id"
            placeholder="Admin user ID"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[44px] font-mono text-xs"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <LoadingButton
                type="submit"
                isLoading={isPending}
                loadingText="Assigning…"
                disabled={!value.trim() || isPending}
                className="w-full md:w-auto"
              >
                Assign
              </LoadingButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Route this case to the chosen admin — they'll become the primary owner
          </TooltipContent>
        </Tooltip>
      </form>
    </section>
  );
}

function BackLink({
  loadingHref,
  handleNavClick,
}: {
  loadingHref: string | null;
  handleNavClick: (href: string) => void;
}) {
  const href = "/admin/support-cases";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
          <Link href={href} onClick={() => handleNavClick(href)}>
            {loadingHref === href ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Back to cases
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Return to the full support cases queue
      </TooltipContent>
    </Tooltip>
  );
}

function SlaChip({ slaDueAt }: { slaDueAt: number }) {
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = slaDueAt - now;
  const hoursLeft = Math.floor(Math.abs(secondsLeft) / 3600);
  const overdue = secondsLeft < 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            overdue
              ? "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
              : hoursLeft < 24
                ? "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning"
                : "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {overdue
            ? `SLA overdue by ${hoursLeft}h`
            : hoursLeft < 24
              ? `SLA in ${hoursLeft}h`
              : `SLA ${formatRelative(slaDueAt)}`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Response SLA deadline based on the tenant's support tier
      </TooltipContent>
    </Tooltip>
  );
}
