"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Hourglass,
  Loader2,
  PlayCircle,
  ArrowLeft,
} from "lucide-react";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { NavButton } from "@/components/recipes/nav-button";
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
  CasePriorityDot,
  CaseCategoryBadge,
  SupportTierBadge,
  SlaChip,
  CaseMessageThread,
  ReplyComposer,
  CaseDetailLayout,
  RailSection,
  PropertyList,
  AdminSearchCombobox,
} from "@/features/support-cases/components";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import type { AdminSearchResult } from "@/types/admin";
import type { SupportCaseStatus } from "@/types/enums";

const BACK_HREF = "/admin/support-cases";

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
      hint: "Let the organization know we've seen the case and will be picking it up shortly",
      icon: CheckCircle2,
    },
  ],
  acknowledged: [
    {
      to: "in_progress",
      label: "Start working",
      hint: "Move the case into active investigation — visible to the organization",
      icon: PlayCircle,
    },
  ],
  in_progress: [
    {
      to: "awaiting_tenant",
      label: "Ask organization",
      hint: "Pause progress while we wait for the organization to respond with more information",
      icon: Hourglass,
    },
    {
      to: "resolved",
      label: "Mark resolved",
      hint: "We've fixed the issue — the organization can confirm or reopen",
      icon: CheckCircle2,
    },
  ],
  awaiting_tenant: [
    {
      to: "in_progress",
      label: "Resume",
      hint: "Organization replied — return the case to active work",
      icon: PlayCircle,
    },
  ],
  reopened: [
    {
      to: "in_progress",
      label: "Pick back up",
      hint: "Organization reopened — move the case back into active work",
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
  const { loadingHref } = useNavigationLoading();

  const { data: detail, isLoading, isError, refetch } = useAdminSupportCase(caseId);
  const { data: messages } = useAdminSupportCaseMessages(caseId, !!detail);
  const replyMutation = useAdminReplySupportCase(caseId);
  const transitionMutation = useAdminTransition(caseId);
  const assignMutation = useAssignAdmin(caseId);

  if (isError || (!isLoading && !detail)) {
    return (
      <div className="space-y-4">
        <ErrorBackLink loadingHref={loadingHref} />
        <ErrorState
          title="Couldn't load this case"
          message="The case may have been closed, or your connection dropped."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading || !detail) {
    return <DetailLoading loadingHref={loadingHref} />;
  }

  const { case: supportCase } = detail;
  const threadMessages = messages ?? detail.messages;
  const status = supportCase.status;
  const transitions = ADMIN_TRANSITIONS[status] ?? [];
  const isClosed = status === "closed";
  const showSla = !!supportCase.slaDueAt && !isClosed && status !== "resolved";

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

  const handleAssign = async (adminId: string) => {
    try {
      await assignMutation.mutateAsync({ adminId });
      toast.success("Assigned admin updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update the assignment",
      );
    }
  };

  const tenantName =
    supportCase.tenantSummary?.companyName?.trim() || supportCase.tenantId;
  const openedByName =
    supportCase.openedBySummary?.fullName?.trim() ||
    formatRole(supportCase.openedByRole);
  const assignedName = supportCase.assignedAdminSummary?.fullName?.trim() ?? null;

  const properties = [
    { label: "Category", value: <CaseCategoryBadge category={supportCase.category} /> },
    ...(supportCase.supportTier
      ? [{ label: "Tier", value: <SupportTierBadge tier={supportCase.supportTier} /> }]
      : []),
    { label: "Organization", value: <span className="truncate">{tenantName}</span> },
    {
      label: "Opened by",
      value: <span className="truncate">{openedByName}</span>,
    },
    {
      label: "Opened",
      value: (
        <span title={formatDateTime(supportCase.dateCreated)}>
          {formatRelative(supportCase.dateCreated)}
        </span>
      ),
    },
    {
      label: "Last activity",
      value: formatRelative(supportCase.lastMessageAt ?? supportCase.lastUpdated),
    },
  ];

  const rail = (
    <>
      <RailSection title="Properties">
        <PropertyList items={properties} />
      </RailSection>

      <Separator />

      <RailSection title="Workflow">
        {transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isClosed
              ? "This case is closed. The organization can reopen it to continue."
              : status === "resolved"
                ? "Waiting for the organization to confirm resolution or reopen the case."
                : "No admin transitions available from this state."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
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
                        className="w-full justify-start"
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
      </RailSection>

      <Separator />

      <RailSection title="Assignment">
        <AssignControl
          currentName={assignedName}
          isPending={assignMutation.isPending}
          onAssign={handleAssign}
        />
      </RailSection>
    </>
  );

  return (
    <CaseDetailLayout
      backHref={BACK_HREF}
      backTooltip="Return to the full support cases queue"
      loadingHref={loadingHref}
      title={supportCase.subject}
      badges={
        <>
          <CaseStatusBadge status={status} />
          <CasePriorityDot priority={supportCase.priority} />
          {showSla && supportCase.slaDueAt && (
            <SlaChip slaDueAt={supportCase.slaDueAt} />
          )}
        </>
      }
      rail={rail}
      composer={
        <ReplyComposer
          caseId={caseId}
          onSubmit={handleReply}
          isSubmitting={replyMutation.isPending}
          disabled={isClosed}
          disabledReason="This case is closed. The organization needs to reopen it first."
          allowInternalNote
          placeholder="Reply to the organization, or check 'Internal note' for admin-only context…"
        />
      }
    >
      <CaseMessageThread
        messages={threadMessages}
        showInternalNotes
        openingRequest={{
          body: supportCase.description,
          dateCreated: supportCase.dateCreated,
          authorLabel: openedByName,
        }}
      />
    </CaseDetailLayout>
  );
}

function AssignControl({
  currentName,
  isPending,
  onAssign,
}: {
  currentName: string | null;
  isPending: boolean;
  onAssign: (adminId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<AdminSearchResult | null>(null);

  const handleSubmit = async () => {
    if (!selected) return;
    await onAssign(selected.id);
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Currently:{" "}
        <span className="font-medium text-foreground">
          {currentName ?? "Unassigned"}
        </span>
      </p>
      <AdminSearchCombobox
        selected={selected}
        onSelect={setSelected}
        id="assign-admin"
      />
      <div className="flex justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <LoadingButton
                type="button"
                onClick={handleSubmit}
                isLoading={isPending}
                loadingText="Assigning…"
                disabled={!selected || isPending}
                className="w-full md:w-auto"
              >
                Assign
              </LoadingButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Route this case to the selected admin — they&apos;ll become the primary owner
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ErrorBackLink({ loadingHref }: { loadingHref: string | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavButton href={BACK_HREF} variant="ghost" size="sm" className="min-h-[44px]">
          {loadingHref === BACK_HREF ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Back to cases
        </NavButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Return to the full support cases queue
      </TooltipContent>
    </Tooltip>
  );
}

function DetailLoading({ loadingHref }: { loadingHref: string | null }) {
  return (
    <div className="space-y-4">
      <ErrorBackLink loadingHref={loadingHref} />
      <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <div className="space-y-3">
          <div className="ml-auto h-16 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="mr-auto h-20 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="ml-auto h-16 w-2/3 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted lg:mt-0" />
      </div>
    </div>
  );
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
