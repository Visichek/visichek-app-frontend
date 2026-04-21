"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  PlayCircle,
  Search,
  ShieldCheck,
  UserCog,
  X,
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
  useSearchAdmins,
} from "@/features/support-cases/hooks/use-admin-support-cases";
import type { AdminSearchResult } from "@/types/admin";
import type { AccountStatus } from "@/types/enums";
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
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<AdminSearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const searchQuery = !selected ? debouncedQuery.trim() : "";
  const {
    data: results = [],
    isFetching,
    isError,
  } = useSearchAdmins(searchQuery);

  const showDropdown = isOpen && !selected && searchQuery.length >= 1;

  const handleSelect = (admin: AdminSearchResult) => {
    setSelected(admin);
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await onAssign(selected.id);
    setSelected(null);
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

      <form onSubmit={handleSubmit} className="space-y-3">
        <div ref={containerRef} className="relative">
          <Label htmlFor="assign-admin-search" className="sr-only">
            Search admin by email, name, or ID
          </Label>

          {selected ? (
            <SelectedAdminPreview admin={selected} onClear={handleClear} />
          ) : (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="assign-admin-search"
                placeholder="Search by email, name, or admin ID…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                autoComplete="off"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls="assign-admin-results"
                className="min-h-[44px] pl-9 text-base md:text-sm"
              />
              {isFetching && (
                <Loader2
                  className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </div>
          )}

          {showDropdown && (
            <div
              id="assign-admin-results"
              role="listbox"
              className="absolute left-0 right-0 top-full z-dropdown mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
            >
              {isError ? (
                <div className="px-3 py-6 text-center text-sm text-destructive">
                  Couldn't reach the admin directory. Try again in a moment.
                </div>
              ) : results.length === 0 && !isFetching ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No admins matched "{searchQuery}". Try an email, name, or full ID.
                </div>
              ) : (
                results.map((admin) => (
                  <AdminResultRow
                    key={admin.id}
                    admin={admin}
                    onSelect={() => handleSelect(admin)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
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
              Route this case to the selected admin — they'll become the primary owner
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </section>
  );
}

function SelectedAdminPreview({
  admin,
  onClear,
}: {
  admin: AdminSearchResult;
  onClear: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {getInitials(admin.fullName)}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{admin.fullName}</span>
          <AccountStatusPill status={admin.accountStatus} />
          {admin.mfaEnabled && <MfaPill />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{admin.email}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {admin.id}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClear}
            aria-label="Clear selected admin"
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Clear the selection and search for a different admin
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function AdminResultRow({
  admin,
  onSelect,
}: {
  admin: AdminSearchResult;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected="false"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-accent/60 focus:bg-accent/60 focus:outline-none"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {getInitials(admin.fullName)}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {admin.fullName}
          </span>
          <AccountStatusPill status={admin.accountStatus} />
          {admin.mfaEnabled && <MfaPill />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{admin.email}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {admin.id}
        </div>
      </div>
    </button>
  );
}

function AccountStatusPill({ status }: { status: AccountStatus }) {
  const styles: Record<AccountStatus, string> = {
    ACTIVE: "border-success/50 bg-success/10 text-success",
    INACTIVE: "border-border bg-muted text-muted-foreground",
    SUSPENDED: "border-destructive/50 bg-destructive/10 text-destructive",
  };
  const label: Record<AccountStatus, string> = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    SUSPENDED: "Suspended",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}
    >
      {label[status]}
    </span>
  );
}

function MfaPill() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-full border border-info/50 bg-info/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-info">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          MFA
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        This admin has two-factor authentication enabled
      </TooltipContent>
    </Tooltip>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
