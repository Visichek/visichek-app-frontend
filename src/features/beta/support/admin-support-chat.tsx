"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Hourglass,
  Inbox,
  Loader2,
  PlayCircle,
  Search,
  SlidersHorizontal,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
  useAdminSupportCases,
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
  AdminSearchCombobox,
} from "@/features/support-cases/components";
import type { ReplyComposerValues } from "@/features/support-cases/components/reply-composer";
import { BetaBadge } from "@/features/beta/components/beta-badge";
import { ChatShell } from "@/features/beta/components/chat/chat-shell";
import {
  ConversationAvatar,
  ConversationItem,
} from "@/features/beta/components/chat/conversation-item";
import { ChatEmptyState } from "@/features/beta/components/chat/chat-empty-state";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import type { AdminSearchResult } from "@/types/admin";
import type { SupportCase } from "@/types/support-case";
import type { SupportCaseStatus } from "@/types/enums";

type StatusFilter = SupportCaseStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_tenant", label: "Awaiting organization" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
];

/**
 * Admin-legal transitions — mirrors the classic admin detail page.
 * `resolved → closed` and reopening are tenant-driven.
 */
const ADMIN_TRANSITIONS: Record<
  SupportCaseStatus,
  {
    to: SupportCaseStatus;
    label: string;
    hint: string;
    icon: typeof PlayCircle;
  }[]
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

const CHAT_LIST_LIMIT = 50;

function caseId(c: SupportCase): string {
  return c.id ?? c._id ?? "";
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Beta admin Support Cases — the same Google Chat-style split pane as the
 * tenant side, plus admin verbs: workflow transitions, assignment, internal
 * notes, and server-side search across organizations.
 */
export function AdminSupportChat() {
  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <AdminSupportChatInner />
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

function AdminSupportChatInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("case") ?? "";
  const { loadingHref } = useNavigationLoading();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const listParams = useMemo(
    () => ({
      q: debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : undefined,
      status: status === "all" ? undefined : status,
      sort: "-last_updated" as const,
      skip: 0,
      limit: CHAT_LIST_LIMIT,
    }),
    [debouncedSearch, status],
  );
  const { data, isLoading, isError, refetch } = useAdminSupportCases(listParams);
  const conversations = data?.items ?? [];

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useAdminSupportCase(selectedId);

  const select = (id: string) =>
    router.replace(`${pathname}?case=${id}`, { scroll: false });
  const clearSelection = () => router.replace(pathname, { scroll: false });

  const slaWatchHref = "/admin/support-cases/sla-watch";

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
            placeholder="Search subject or description…"
            aria-label="Search all support conversations by subject or description"
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
              <Inbox
                className="h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <div>
              <p className="text-sm font-medium">No conversations</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {debouncedSearch || status !== "all"
                  ? "Nothing matches your search or filter."
                  : "New organization cases will appear here."}
              </p>
            </div>
          </div>
        ) : (
          conversations.map((c) => {
            const id = caseId(c);
            const orgName =
              c.tenantSummary?.companyName?.trim() || c.tenantId;
            return (
              <ConversationItem
                key={id}
                title={orgName}
                snippet={c.subject}
                timestamp={c.lastMessageAt ?? c.lastUpdated}
                selected={id === selectedId}
                loading={id === selectedId && detailLoading}
                onSelect={() => select(id)}
                avatar={<ConversationAvatar seed={orgName} />}
                meta={
                  <>
                    <CaseStatusBadge status={c.status} />
                    <CasePriorityDot priority={c.priority} />
                    {c.supportTier && c.supportTier !== "none" && (
                      <SupportTierBadge tier={c.supportTier} />
                    )}
                  </>
                }
                tooltip={`Open ${orgName}'s case "${c.subject}" to triage and reply`}
                ariaLabel={`Open support case ${c.subject} from ${orgName}`}
              />
            );
          })
        )}
      </div>
    </div>
  );

  const pane = selectedId ? (
    <AdminConversationPane
      key={selectedId}
      selectedId={selectedId}
      detail={detail}
      isLoading={detailLoading}
      isError={detailError}
      onRetry={() => refetchDetail()}
      onBack={clearSelection}
    />
  ) : (
    <ChatEmptyState hint="Pick an organization's case from the list to triage the thread and reply." />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Support
            </h1>
            <BetaBadge hint="You're seeing the early-access admin design. Turn it off any time from Settings → Platform → Beta features." />
          </div>
          <p className="text-sm text-muted-foreground">
            Every organization case as a conversation — triage, assign, and
            reply in one place.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <NavButton
                href={slaWatchHref}
                variant="outline"
                className="min-h-[44px] w-full md:w-auto"
              >
                {loadingHref === slaWatchHref ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                SLA watch
              </NavButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Open the SLA calendar to see which cases are due or overdue
          </TooltipContent>
        </Tooltip>
      </div>

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

function AdminConversationPane({
  selectedId,
  detail,
  isLoading,
  isError,
  onRetry,
  onBack,
}: {
  selectedId: string;
  detail: ReturnType<typeof useAdminSupportCase>["data"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { data: messages } = useAdminSupportCaseMessages(selectedId, !!detail);
  const replyMutation = useAdminReplySupportCase(selectedId);
  const transitionMutation = useAdminTransition(selectedId);
  const assignMutation = useAssignAdmin(selectedId);

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
          <Skeleton className="ml-auto h-16 w-3/4 rounded-lg" />
          <Skeleton className="mr-auto h-20 w-3/4 rounded-lg" />
          <Skeleton className="ml-auto h-16 w-2/3 rounded-lg" />
        </div>
      </div>
    );
  }

  const supportCase = detail.case;
  const threadMessages = messages ?? detail.messages;
  const status = supportCase.status;
  const transitions = ADMIN_TRANSITIONS[status] ?? [];
  const isClosed = status === "closed";
  const showSla = !!supportCase.slaDueAt && !isClosed && status !== "resolved";

  const tenantName =
    supportCase.tenantSummary?.companyName?.trim() || supportCase.tenantId;
  const openedByName =
    supportCase.openedBySummary?.fullName?.trim() ||
    formatRole(supportCase.openedByRole);
  const assignedName =
    supportCase.assignedAdminSummary?.fullName?.trim() ?? null;

  const handleReply = async (values: ReplyComposerValues) => {
    try {
      await replyMutation.mutateAsync({
        body: values.body,
        attachments: values.attachments,
        internalNote: values.internalNote ?? false,
      });
      toast.success(values.internalNote ? "Internal note saved" : "Reply sent");
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
            Go back to the conversation list
          </TooltipContent>
        </Tooltip>
        <ConversationAvatar seed={tenantName} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold md:text-base">
            {supportCase.subject}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {tenantName} · opened by {openedByName}
          </p>
        </div>
        <Sheet>
          <Tooltip>
            <TooltipTrigger asChild>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open case details, workflow, and assignment"
                  className="h-11 w-11 shrink-0"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </SheetTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              See case properties, change status, or assign an admin
            </TooltipContent>
          </Tooltip>
          <SheetContent side="right" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Case details</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>
                    <CaseCategoryBadge category={supportCase.category} />
                  </dd>
                </div>
                {supportCase.supportTier && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Tier</dt>
                    <dd>
                      <SupportTierBadge tier={supportCase.supportTier} />
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Organization</dt>
                  <dd className="truncate font-medium">{tenantName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Opened by</dt>
                  <dd className="truncate">{openedByName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Opened</dt>
                  <dd title={formatDateTime(supportCase.dateCreated)}>
                    {formatRelative(supportCase.dateCreated)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Last activity</dt>
                  <dd>
                    {formatRelative(
                      supportCase.lastMessageAt ?? supportCase.lastUpdated,
                    )}
                  </dd>
                </div>
              </dl>

              <Separator />

              <div>
                <h3 className="mb-2 text-sm font-semibold">Assignment</h3>
                <AssignControl
                  currentName={assignedName}
                  isPending={assignMutation.isPending}
                  onAssign={handleAssign}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
        <CaseStatusBadge status={status} />
        <CasePriorityDot priority={supportCase.priority} />
        {showSla && supportCase.slaDueAt && (
          <SlaChip slaDueAt={supportCase.slaDueAt} />
        )}
        <span className="flex-1" />
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
                    size="sm"
                    variant={t.to === "resolved" ? "default" : "outline"}
                    onClick={() => handleTransition(t.to)}
                    isLoading={isPending}
                    loadingText="Updating…"
                    disabled={transitionMutation.isPending}
                    className="min-h-[36px]"
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {t.label}
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t.hint}</TooltipContent>
            </Tooltip>
          );
        })}
        {transitions.length === 0 && (
          <span className="text-xs text-muted-foreground">
            {isClosed
              ? "Closed — the organization can reopen it."
              : status === "resolved"
                ? "Waiting for the organization to confirm or reopen."
                : null}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <CaseMessageThread
          messages={threadMessages}
          showInternalNotes
          openingRequest={{
            body: supportCase.description,
            dateCreated: supportCase.dateCreated,
            authorLabel: openedByName,
          }}
        />
      </div>

      <div className="shrink-0 border-t border-border bg-background p-3">
        <ReplyComposer
          caseId={selectedId}
          onSubmit={handleReply}
          isSubmitting={replyMutation.isPending}
          disabled={isClosed}
          disabledReason="This case is closed. The organization needs to reopen it first."
          allowInternalNote
          placeholder="Reply to the organization, or check 'Internal note' for admin-only context…"
        />
      </div>
    </div>
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
        id="beta-assign-admin"
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
            Route this case to the selected admin — they&apos;ll become the
            primary owner
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
