"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { NavButton } from "@/components/recipes/nav-button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useSupportCases,
  useSupportCase,
  useSupportCaseMessages,
  useReplySupportCase,
  useCloseSupportCase,
  useReopenSupportCase,
} from "@/features/support-cases/hooks/use-support-cases";
import {
  CaseStatusBadge,
  CasePriorityDot,
  SlaChip,
  CaseMessageThread,
  ReplyComposer,
  QuotaBanner,
  CASE_CATEGORY_LABELS,
} from "@/features/support-cases/components";
import type { ReplyComposerValues } from "@/features/support-cases/components/reply-composer";
import { BetaBadge } from "@/features/beta/components/beta-badge";
import { ChatShell } from "@/features/beta/components/chat/chat-shell";
import {
  ConversationAvatar,
  ConversationItem,
} from "@/features/beta/components/chat/conversation-item";
import { ChatEmptyState } from "@/features/beta/components/chat/chat-empty-state";
import type { SupportCase } from "@/types/support-case";
import type { SupportCaseStatus } from "@/types/enums";

// Mirrors the backend OPEN_STATUSES (everything except `closed`) — a resolved
// case still holds a slot against the 10-open-case cap until it closes.
const OPEN_STATUSES: SupportCaseStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "awaiting_tenant",
  "resolved",
  "reopened",
];

type StatusFilter = SupportCaseStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_tenant", label: "Awaiting you" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
];

/** How many conversations the chat list loads (most recent first). */
const CHAT_LIST_LIMIT = 50;

function caseId(c: SupportCase): string {
  return c.id ?? c._id ?? "";
}

/**
 * Beta tenant Support Cases — Google Chat-style split pane. Conversation
 * list on the left, thread + composer on the right, `?case=` in the URL so
 * selections survive refresh and can be shared.
 */
export function TenantSupportChat() {
  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <TenantSupportChatInner />
    </Suspense>
  );
}

function ChatPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-[calc(100dvh-12rem)] min-h-[480px] w-full rounded-xl" />
    </div>
  );
}

function TenantSupportChatInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("case") ?? "";
  const { loadingHref } = useNavigationLoading();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const listParams = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      skip: 0,
      limit: CHAT_LIST_LIMIT,
    }),
    [status],
  );
  const { data, isLoading, isError, refetch } = useSupportCases(listParams);

  // Open-case count for the 10-case cap, from the status facet (counts the
  // whole tenant, not just the loaded page).
  const { data: facetData } = useSupportCases({ facets: "status", limit: 1 });
  const statusFacets = facetData?.meta?.facets?.status;
  const openCount = useMemo(() => {
    if (statusFacets) {
      return OPEN_STATUSES.reduce((sum, s) => sum + (statusFacets[s] ?? 0), 0);
    }
    return (data?.items ?? []).filter((c) => OPEN_STATUSES.includes(c.status))
      .length;
  }, [statusFacets, data]);
  const atCap = openCount >= 10;

  const conversations = useMemo(() => {
    const items = [...(data?.items ?? [])];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (c) =>
            c.subject.toLowerCase().includes(q) ||
            (c.description ?? "").toLowerCase().includes(q),
        )
      : items;
    return filtered.sort(
      (a, b) =>
        (b.lastMessageAt ?? b.lastUpdated) - (a.lastMessageAt ?? a.lastUpdated),
    );
  }, [data, search]);

  // Detail for the open conversation.
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useSupportCase(selectedId);

  const select = (id: string) => {
    router.replace(`${pathname}?case=${id}`, { scroll: false });
  };
  const clearSelection = () => {
    router.replace(pathname, { scroll: false });
  };

  const newCaseHref = "/app/support-cases/new";

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search your support conversations by subject or description"
            className="min-h-[44px] pl-9 text-base md:text-sm"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StatusFilter)}
              >
                <SelectTrigger
                  className="min-h-[44px]"
                  aria-label="Filter conversations by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Show only conversations in a specific workflow status
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" role="list">
        {isError ? (
          <div className="p-4">
            <ErrorState
              title="Couldn't load conversations"
              message="Please check your connection and try again."
              onRetry={() => refetch()}
            />
          </div>
        ) : isLoading ? (
          <ListSkeleton />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <LifeBuoy
                className="h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <div>
              <p className="text-sm font-medium">No conversations</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search || status !== "all"
                  ? "Nothing matches your search or filter."
                  : "Open a case when you need help — our team replies right here."}
              </p>
            </div>
          </div>
        ) : (
          conversations.map((c) => {
            const id = caseId(c);
            return (
              <ConversationItem
                key={id}
                title={c.subject}
                snippet={
                  c.description ??
                  CASE_CATEGORY_LABELS[c.category] ??
                  c.category
                }
                timestamp={c.lastMessageAt ?? c.lastUpdated}
                selected={id === selectedId}
                loading={id === selectedId && detailLoading}
                onSelect={() => select(id)}
                avatar={<ConversationAvatar seed={c.subject} />}
                meta={
                  <>
                    <CaseStatusBadge status={c.status} />
                    <CasePriorityDot priority={c.priority} />
                  </>
                }
                tooltip={`Open "${c.subject}" to read the conversation and reply`}
                ariaLabel={`Open support case ${c.subject}`}
              />
            );
          })
        )}
      </div>
    </div>
  );

  const pane = selectedId ? (
    <ConversationPane
      key={selectedId}
      selectedId={selectedId}
      detail={detail}
      isLoading={detailLoading}
      isError={detailError}
      onRetry={() => refetchDetail()}
      onBack={clearSelection}
    />
  ) : (
    <ChatEmptyState hint="Pick a case from the list to read the thread and reply, or open a new case." />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Support
            </h1>
            <BetaBadge />
          </div>
          <p className="text-sm text-muted-foreground">
            Chat with the VisiChek support team — every case is a conversation.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              {atCap ? (
                <Button disabled className="min-h-[44px] w-full md:w-auto">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  New case
                </Button>
              ) : (
                <NavButton
                  href={newCaseHref}
                  className="min-h-[44px] w-full md:w-auto"
                >
                  {loadingHref === newCaseHref ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  New case
                </NavButton>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {atCap
              ? "You've hit the 10-open-case cap. Resolve or close one before opening a new case."
              : "Start a new conversation with the VisiChek support team"}
          </TooltipContent>
        </Tooltip>
      </div>

      <QuotaBanner openCount={openCount} />

      <ChatShell list={list} pane={pane} showPaneOnMobile={!!selectedId} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg p-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationPane({
  selectedId,
  detail,
  isLoading,
  isError,
  onRetry,
  onBack,
}: {
  selectedId: string;
  detail: ReturnType<typeof useSupportCase>["data"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { data: messages } = useSupportCaseMessages(selectedId, !!detail);
  const replyMutation = useReplySupportCase(selectedId);
  const closeMutation = useCloseSupportCase(selectedId);
  const reopenMutation = useReopenSupportCase(selectedId);

  if (isError || (!isLoading && !detail)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState
          title="Couldn't load this conversation"
          message="The case may have been closed, or your connection dropped."
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <Skeleton className="h-6 w-2/3" />
        </div>
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="mr-auto h-20 w-3/4 rounded-lg" />
          <Skeleton className="ml-auto h-16 w-3/4 rounded-lg" />
          <Skeleton className="mr-auto h-16 w-2/3 rounded-lg" />
        </div>
      </div>
    );
  }

  const supportCase = detail.case;
  const threadMessages = messages ?? detail.messages;
  const status = supportCase.status;
  const isResolved = status === "resolved";
  const isClosed = status === "closed";
  const canReply = !isClosed;
  const showSla = !!supportCase.slaDueAt && !isResolved && !isClosed;

  const handleReply = async (values: ReplyComposerValues) => {
    try {
      await replyMutation.mutateAsync({
        body: values.body,
        attachments: values.attachments,
      });
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
      toast.error(
        err instanceof Error ? err.message : "Couldn't close the case",
      );
    }
  };

  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync();
      toast.success("Case reopened — we'll pick it back up.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't reopen the case",
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Back to the conversation list"
              className="h-11 w-11 lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Go back to your conversation list
          </TooltipContent>
        </Tooltip>
        <ConversationAvatar seed={supportCase.subject} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold md:text-base">
            {supportCase.subject}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <CaseStatusBadge status={status} />
            <CasePriorityDot priority={supportCase.priority} />
            {showSla && supportCase.slaDueAt && (
              <SlaChip slaDueAt={supportCase.slaDueAt} />
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isResolved && (
          <section
            aria-label="Resolution actions"
            className="mb-3 rounded-lg border border-success/40 bg-success/10 p-4"
          >
            <p className="mb-3 text-sm">
              <span className="font-semibold">
                We&apos;ve marked this resolved.
              </span>{" "}
              Confirm the fix worked, or reopen if you&apos;re still having
              trouble.
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
                      <CheckCircle2
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Confirm resolution
                    </LoadingButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Close this case permanently. You&apos;ll lose the ability to
                  reply after this.
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
                  Send this case back to our team because the issue isn&apos;t
                  fully fixed
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
            Reply below with the information our team requested — posting a
            reply automatically moves this case back to &ldquo;In
            progress&rdquo;.
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
      </div>

      <div className="shrink-0 border-t border-border bg-background p-3">
        <ReplyComposer
          caseId={selectedId}
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
      </div>
    </div>
  );
}
