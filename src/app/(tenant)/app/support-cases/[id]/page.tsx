"use client";

import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  useSupportCase,
  useSupportCaseMessages,
  useReplySupportCase,
  useCloseSupportCase,
  useReopenSupportCase,
} from "@/features/support-cases/hooks/use-support-cases";
import {
  CaseStatusBadge,
  CasePriorityBadge,
  CaseCategoryBadge,
  CaseMessageThread,
  ReplyComposer,
} from "@/features/support-cases/components";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";

export default function SupportCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const { data: detail, isLoading, isError, refetch } = useSupportCase(caseId);
  const { data: messages } = useSupportCaseMessages(caseId, !!detail);
  const replyMutation = useReplySupportCase(caseId);
  const closeMutation = useCloseSupportCase(caseId);
  const reopenMutation = useReopenSupportCase(caseId);

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
  // Prefer the polling thread; fall back to the detail payload on first paint.
  const threadMessages = messages ?? detail.messages;

  const status = supportCase.status;
  const isResolved = status === "resolved";
  const isClosed = status === "closed";
  const canReply = !isClosed;

  const handleReply = async ({
    body,
    attachments,
  }: {
    body: string;
    attachments: { objectKey: string; fileName: string; mimeType: string; size: number }[];
  }) => {
    try {
      await replyMutation.mutateAsync({ body, attachments });
      toast.success("Reply sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reply");
    }
  };

  const handleConfirmResolution = async () => {
    try {
      await closeMutation.mutateAsync();
      toast.success("Case closed. Thanks for confirming!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't close the case");
    }
  };

  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync();
      toast.success("Case reopened — we'll pick it back up.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reopen the case");
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
        {supportCase.slaDueAt && !isResolved && !isClosed && (
          <SlaChip slaDueAt={supportCase.slaDueAt} />
        )}
      </div>

      {/* Original description as the first "message" in the thread */}
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

      {/* Resolved-case actions */}
      {isResolved && (
        <section
          aria-label="Resolution actions"
          className="rounded-lg border border-success/40 bg-success/10 p-4"
        >
          <p className="mb-3 text-sm">
            <span className="font-semibold">We've marked this resolved.</span>{" "}
            Confirm the fix worked, or reopen if you're still having trouble.
          </p>
          <div className="flex flex-col gap-2 md:flex-row">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    onClick={handleConfirmResolution}
                    isLoading={closeMutation.isPending}
                    loadingText="Closing…"
                    className="w-full md:w-auto"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Confirm resolution
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Close this case permanently. You'll lose the ability to reply after this.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    variant="outline"
                    onClick={handleReopen}
                    isLoading={reopenMutation.isPending}
                    loadingText="Reopening…"
                    className="w-full md:w-auto"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Reopen
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Send this case back to our team because the issue isn't fully fixed
              </TooltipContent>
            </Tooltip>
          </div>
        </section>
      )}

      {status === "awaiting_tenant" && (
        <section
          aria-label="Awaiting your response"
          className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <span className="font-semibold">We're waiting on you.</span>{" "}
          Reply below with the information our team requested — posting a reply
          automatically moves this case back to "In progress".
        </section>
      )}

      {/* Thread */}
      <section aria-label="Conversation" className="space-y-2">
        <h2 className="text-base font-semibold">Conversation</h2>
        <CaseMessageThread messages={threadMessages} />
      </section>

      {/* Reply composer */}
      <section aria-label="Reply" className="space-y-2">
        <h2 className="text-base font-semibold">
          {isResolved ? "Add a follow-up reply" : "Reply"}
        </h2>
        <ReplyComposer
          caseId={caseId}
          onSubmit={handleReply}
          isSubmitting={replyMutation.isPending}
          disabled={!canReply}
          disabledReason="This case is closed. Reopen it to continue the conversation."
          placeholder={
            isResolved
              ? "Something still not working? Reply here to reopen the conversation."
              : "Write your reply…"
          }
        />
      </section>
    </div>
  );
}

function BackLink({
  loadingHref,
  handleNavClick,
}: {
  loadingHref: string | null;
  handleNavClick: (href: string) => void;
}) {
  const href = "/app/support-cases";
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
        Return to your list of support cases
      </TooltipContent>
    </Tooltip>
  );
}

function SlaChip({ slaDueAt }: { slaDueAt: number }) {
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = slaDueAt - now;
  const hoursLeft = Math.floor(secondsLeft / 3600);
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
            ? "SLA overdue"
            : hoursLeft < 24
              ? `SLA in ${hoursLeft}h`
              : `SLA ${formatRelative(slaDueAt)}`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        The target response SLA for this case based on your plan's support tier.
      </TooltipContent>
    </Tooltip>
  );
}
