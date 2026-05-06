"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Loader2,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatRelative } from "@/lib/utils/format-date";
import {
  useArchiveOnboarding,
  useOnboardingSubmissions,
} from "@/features/onboarding/hooks";
import type { OnboardingSubmission } from "@/types/onboarding";
import type { OnboardingStatus } from "@/types/enums";

const TENANTS_HREF = "/admin/tenants";

function detailHref(submissionId: string) {
  return `/admin/tenants/onboarding/${submissionId}`;
}

const STATUS_TABS: { value: OnboardingStatus | "all"; label: string }[] = [
  { value: "new", label: "New" },
  { value: "partial_accepted", label: "Awaiting completion" },
  { value: "completed", label: "Completed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

function statusVariant(status: OnboardingStatus) {
  switch (status) {
    case "new":
      return "info" as const;
    case "accepted":
      return "success" as const;
    case "completed":
      return "success" as const;
    case "partial_accepted":
      return "warning" as const;
    case "rejected":
      return "destructive" as const;
    case "archived":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function statusLabel(status: OnboardingStatus): string {
  return status.replace(/_/g, " ");
}

interface RowActionsProps {
  submission: OnboardingSubmission;
  onArchive: (submission: OnboardingSubmission) => void;
}

function RowActions({ submission, onArchive }: RowActionsProps) {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const href = detailHref(submission.id);
  const canArchive =
    submission.status === "new" ||
    submission.status === "rejected";

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Submission actions"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open actions menu</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          Open actions for this onboarding submission
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={href} onClick={() => handleNavClick(href)}>
            {loadingHref === href ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Review submission
          </Link>
        </DropdownMenuItem>
        {canArchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onArchive(submission)}
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              Archive (spam / duplicate)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OnboardingQueueClient() {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const [statusFilter, setStatusFilter] =
    useState<OnboardingStatus | "all">("new");
  const [archiveTarget, setArchiveTarget] =
    useState<OnboardingSubmission | null>(null);

  const params =
    statusFilter === "all" ? undefined : { status: statusFilter };
  const { data, isLoading } = useOnboardingSubmissions(params);
  const submissions = data ?? [];

  const archive = useArchiveOnboarding();

  function handleArchiveConfirm() {
    if (!archiveTarget) return;
    toast.promise(archive.mutateAsync(archiveTarget.id), {
      loading: "Archiving submission…",
      success: () => {
        const label =
          archiveTarget.organizationName ||
          archiveTarget.fullName ||
          archiveTarget.email ||
          "Submission";
        setArchiveTarget(null);
        return `${label} archived.`;
      },
      error: (err: Error) => err.message || "Failed to archive submission.",
    });
  }

  const columns: ColumnDef<OnboardingSubmission>[] = [
    {
      id: "applicant",
      header: "Applicant",
      cell: ({ row }) => {
        const s = row.original;
        const primary = s.organizationName || s.fullName || "Unnamed lead";
        const secondary = s.fullName && s.organizationName ? s.fullName : null;
        return (
          <div className="space-y-0.5">
            <span className="font-medium">{primary}</span>
            {secondary && (
              <span className="block text-xs text-muted-foreground">{secondary}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.email ?? "—"}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {statusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "verified",
      header: "Turnstile",
      cell: ({ row }) =>
        row.original.turnstileVerified ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                aria-label="Turnstile verified"
              >
                <ShieldCheck className="h-4 w-4" />
                Verified
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Cloudflare Turnstile passed at submission time
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                aria-label="Turnstile not verified"
              >
                <ShieldOff className="h-4 w-4" />
                Skipped
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Turnstile was not enforced (likely a development submission)
            </TooltipContent>
          </Tooltip>
        ),
    },
    {
      id: "submittedAt",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatRelative(row.original.submittedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <RowActions
          submission={row.original}
          onArchive={setArchiveTarget}
        />
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (s: OnboardingSubmission) => {
    const href = detailHref(s.id);
    return (
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <span className="block truncate font-medium">
              {s.organizationName || s.fullName || "Unnamed lead"}
            </span>
            {s.email && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {s.email}
              </span>
            )}
          </div>
          <Badge variant={statusVariant(s.status)}>
            {statusLabel(s.status)}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Submitted {formatRelative(s.submittedAt)} • v{s.formVersion}
        </div>
        <div className="flex items-center justify-between pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                <Link href={href} onClick={() => handleNavClick(href)}>
                  {loadingHref === href ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Review
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Open this submission to accept, partial-accept, or reject it
            </TooltipContent>
          </Tooltip>
          <RowActions
            submission={s}
            onArchive={setArchiveTarget}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title="Archive submission?"
        description="Archived submissions disappear from the default queue but can still be retrieved by switching the status filter to Archived. No tenant is provisioned. Use this for spam or duplicate leads."
        confirmLabel="Archive"
        variant="destructive"
        isLoading={archive.isPending}
        onConfirm={handleArchiveConfirm}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 min-h-[44px]"
          >
            <Link
              href={TENANTS_HREF}
              onClick={() => handleNavClick(TENANTS_HREF)}
            >
              {loadingHref === TENANTS_HREF ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to tenants
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Return to the live tenants list
        </TooltipContent>
      </Tooltip>

      <PageHeader
        title="Onboarding queue"
        description="Self-service signups submitted through the marketing site. Accept to provision a tenant + super admin, partial-accept if some fields still need clarification, or reject with reviewer notes."
      />

      <Tabs
        value={statusFilter}
        onValueChange={(v) =>
          setStatusFilter(v as OnboardingStatus | "all")
        }
      >
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {STATUS_TABS.map((tab) => (
            <Tooltip key={tab.value}>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value={tab.value}
                  className="min-h-[44px]"
                >
                  {tab.label}
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {tab.value === "all"
                  ? "Show submissions in every status"
                  : `Show submissions whose status is "${tab.label.toLowerCase()}"`}
              </TooltipContent>
            </Tooltip>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={submissions}
        isLoading={isLoading}
        pagination
        pageSize={20}
        searchKey="email"
        searchPlaceholder="Search by email…"
        emptyTitle={
          statusFilter === "new"
            ? "Inbox zero"
            : "No submissions in this status"
        }
        emptyDescription={
          statusFilter === "new"
            ? "Nothing new to review. Marketing-site signups will appear here."
            : "Try a different status filter to find what you're looking for."
        }
        mobileCard={mobileCard}
      />
    </div>
  );
}
