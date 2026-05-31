"use client";

import { use } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { NavButton } from "@/components/recipes/nav-button";
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
  CasePriorityDot,
  CaseCategoryBadge,
  SlaChip,
  CaseMessageThread,
  ReplyComposer,
  CaseDetailLayout,
  RailSection,
  PropertyList,
} from "@/features/support-cases/components";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";

const BACK_HREF = "/app/support-cases";

export default function SupportCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const { loadingHref } = useNavigationLoading();

  const { data: detail, isLoading, isError, refetch } = useSupportCase(caseId);
  const { data: messages } = useSupportCaseMessages(caseId, !!detail);
  const replyMutation = useReplySupportCase(caseId);
  const closeMutation = useCloseSupportCase(caseId);
  const reopenMutation = useReopenSupportCase(caseId);

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
  const isResolved = status === "resolved";
  const isClosed = status === "closed";
  const canReply = !isClosed;
  const showSla = !!supportCase.slaDueAt && !isResolved && !isClosed;

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

  const rail = (
    <RailSection title="Properties">
      <PropertyList
        items={[
          {
            label: "Category",
            value: <CaseCategoryBadge category={supportCase.category} />,
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
            value: formatRelative(
              supportCase.lastMessageAt ?? supportCase.lastUpdated,
            ),
          },
        ]}
      />
    </RailSection>
  );

  return (
    <CaseDetailLayout
      backHref={BACK_HREF}
      backTooltip="Return to your list of support cases"
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
          disabled={!canReply}
          disabledReason="This case is closed. Reopen it to continue the conversation."
          placeholder={
            isResolved
              ? "Something still not working? Reply here to reopen the conversation."
              : "Write your reply…"
          }
        />
      }
    >
      {isResolved && (
        <section
          aria-label="Resolution actions"
          className="mb-3 rounded-lg border border-success/40 bg-success/10 p-4"
        >
          <p className="mb-3 text-sm">
            <span className="font-semibold">We&apos;ve marked this resolved.</span>{" "}
            Confirm the fix worked, or reopen if you&apos;re still having trouble.
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
                Close this case permanently. You&apos;ll lose the ability to reply after this.
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
                Send this case back to our team because the issue isn&apos;t fully fixed
              </TooltipContent>
            </Tooltip>
          </div>
        </section>
      )}

      {status === "awaiting_tenant" && (
        <section
          aria-label="Awaiting your response"
          className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <span className="font-semibold">We&apos;re waiting on you.</span>{" "}
          Reply below with the information our team requested — posting a reply
          automatically moves this case back to &ldquo;In progress&rdquo;.
        </section>
      )}

      <CaseMessageThread
        messages={threadMessages}
        openingRequest={{
          body: supportCase.description,
          dateCreated: supportCase.dateCreated,
          authorLabel: "You",
        }}
      />
    </CaseDetailLayout>
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
        Return to your list of support cases
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
          <div className="mr-auto h-20 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="ml-auto h-16 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="mr-auto h-16 w-2/3 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="mt-4 h-48 animate-pulse rounded-lg bg-muted lg:mt-0" />
      </div>
    </div>
  );
}
