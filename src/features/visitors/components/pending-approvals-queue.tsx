"use client";

/**
 * Unified pending-approvals queue rendered on the receptionist's
 * Visitors → Pending tab.
 *
 * Backed by `GET /v1/tenants/{tenantId}/pending-approvals`, which merges
 * two sources: kiosk check-ins awaiting approval (sourceType="checkin")
 * and scheduled appointments the host pre-vetted (sourceType="appointment").
 *
 * Action paths split by discriminator:
 *  - "checkin"     → /app/visitors/{checkinId}/confirm?action=approve|reject
 *  - "appointment" → POST /v1/appointments/{appointmentId}/check-in
 *                    (handled inline; opens /badge/{token} on success)
 */

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  LogIn,
  MoreHorizontal,
  ShieldAlert,
  Unlock,
  UserCheck,
  XCircle,
} from "lucide-react";

import {
  DataTable,
  type DataTableBulkAction,
} from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { BranchLabel } from "@/components/recipes/branch-label";
import { NavButton } from "@/components/recipes/nav-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime } from "@/lib/utils/format-date";
import { summarizeBulkResult } from "@/lib/api/bulk";
import {
  useBulkApproveCheckins,
  useBulkForceApprovePendingCheckins,
  useBulkRejectCheckins,
  useForceApprovePendingCheckin,
  usePendingApprovals,
} from "@/features/checkins/hooks";
import { useCheckInFromAppointment } from "@/features/appointments/hooks/use-appointments";
import {
  AppointmentCheckInPromptModal,
  type AppointmentCheckInMissingField,
} from "@/features/appointments/components/appointment-checkin-prompt-modal";
import {
  PrintBadgeModal,
  type PrintBadgeModalData,
} from "@/features/visitors/components/print-badge-modal";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useShowBranch } from "@/hooks/use-show-branch";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { PendingApprovalItem } from "@/types/checkin";
import { IdentityCheckBadge } from "@/features/checkins/components/identity-check-badge";
import type {
  AppointmentCheckInRequest,
  AppointmentCheckInResponse,
} from "@/types/visitor";
import { ApiError } from "@/types/api";

/**
 * After this much wall-clock time in `pending_verification`, treat the row
 * as stuck — the kiosk crashed, the visitor abandoned the widget, the
 * Dojah webhook never arrived, etc. — and surface the super_admin
 * force-approve recovery affordance per the KYC flow doc.
 */
const STUCK_PENDING_VERIFICATION_THRESHOLD_MS = 10 * 60 * 1000;

function isStuckInPendingVerification(item: PendingApprovalItem): boolean {
  if (item.state !== "pending_verification") return false;
  const ageMs = Date.now() - item.createdAt * 1000;
  return ageMs >= STUCK_PENDING_VERIFICATION_THRESHOLD_MS;
}

/**
 * Read the structured `400 VALIDATION_FAILED` body the backend returns
 * when a field needed by appointment check-in is missing on both the
 * override body and the linked profile. The backend ships:
 *
 *   { code: "VALIDATION_FAILED",
 *     details: { missing_field: "phone" | "full_name", prompt_required: true } }
 *
 * The interceptor normalises it to an `ApiError` with `details` set, but
 * casing depends on the response-case header (camelCase by default,
 * snake_case for legacy callers) — accept either.
 */
function readMissingFieldFromError(
  error: unknown,
): AppointmentCheckInMissingField | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 400) return null;
  const details = error.details;
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const promptRequired = d.promptRequired ?? d.prompt_required;
  if (promptRequired !== true) return null;
  const raw = d.missingField ?? d.missing_field;
  if (raw === "phone") return "phone";
  if (raw === "full_name" || raw === "fullName") return "fullName";
  return null;
}

/**
 * Inspect the row to decide whether we already know we're missing a
 * required field, so we can prompt before calling the endpoint and skip
 * the round-trip 400.
 */
function detectKnownMissingField(
  item: PendingApprovalItem,
): AppointmentCheckInMissingField | null {
  // Phone is the common case — only the linked profile carries it.
  const profilePhone = item.visitor?.phone?.trim();
  if (!profilePhone) return "phone";
  const profileName = item.visitor?.fullName?.trim();
  const snapshotName = item.visitorName?.trim();
  if (!profileName && !snapshotName) return "fullName";
  return null;
}

interface PendingApprovalsQueueProps {
  tenantId: string | undefined;
}

function checkinConfirmHref(id: string, action: "approve" | "reject") {
  return `/app/visitors/${id}/confirm?action=${action}`;
}

function checkinDetailHref(id: string) {
  return `/app/visitors/${id}`;
}

/** Default expiry hint shown on the badge when the backend doesn't supply one. */
const BADGE_DEFAULT_TTL_SECONDS = 12 * 60 * 60;

/**
 * Assemble badge data from an appointment check-in response. Snapshot
 * strings (host/department/visitor name) are written onto the session by
 * the backend at register-time; pull from the row's pre-vetted summary
 * when a field is missing so the badge still renders fully.
 */
function buildBadgeData(
  response: AppointmentCheckInResponse,
  row: PendingApprovalItem,
): PrintBadgeModalData {
  const session = response.session;
  const issuedAt = session.checkedInAt ?? row.scheduledDatetime ?? undefined;
  const visitorName =
    response.visitorProfile.fullName ||
    session.visitorNameSnapshot ||
    row.visitorName ||
    "Unnamed visitor";
  return {
    visitorName,
    company: response.visitorProfile.company ?? row.company ?? undefined,
    purpose: session.purpose ?? row.purpose ?? undefined,
    hostName: session.hostNameSnapshot,
    departmentName: session.departmentNameSnapshot,
    statusLabel: "Checked in",
    qrToken: response.badgeQrToken ?? "",
    issuedAt: issuedAt ?? undefined,
    expiresAt:
      issuedAt !== undefined ? issuedAt + BADGE_DEFAULT_TTL_SECONDS : undefined,
  };
}

export function PendingApprovalsQueue({ tenantId }: PendingApprovalsQueueProps) {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data, isLoading } = usePendingApprovals(tenantId);
  const { systemUserProfile } = useSession();
  const { hasCapability } = useCapabilities();
  /**
   * "Force approve a stuck check-in" is a safety valve, not a routine
   * action — gated to the new `CHECKIN_FORCE_APPROVE` capability so
   * the backend permission dependency and the UI hide together. Only
   * super_admin holds this capability today (granted automatically
   * via `Object.values(C)` in roles.ts).
   *
   * Kept the `isSuperAdmin` local name so the rest of the file's
   * useMemo deps and conditional renders don't need rewriting; the
   * variable now reads from the capability map rather than the
   * role string.
   */
  const isSuperAdmin = hasCapability(CAPABILITIES.CHECKIN_FORCE_APPROVE);
  // Branch column visibility — unscoped roles (and multi-branch users) see
  // a mix of branches in this tenant-wide queue, so the label helps.
  const showBranch = useShowBranch();
  // Suppress unused warning — kept for any future callers that need
  // the raw profile (e.g., audit log attribution).
  void systemUserProfile;
  const checkInFromAppointment = useCheckInFromAppointment();
  const forceApprove = useForceApprovePendingCheckin();
  const bulkApprove = useBulkApproveCheckins();
  const bulkReject = useBulkRejectCheckins();
  const bulkForceApprove = useBulkForceApprovePendingCheckins();
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);
  const [busyForceApproveId, setBusyForceApproveId] = useState<string | null>(
    null,
  );
  const [promptState, setPromptState] = useState<{
    item: PendingApprovalItem;
    field: AppointmentCheckInMissingField;
  } | null>(null);
  /**
   * Badge data populated after a successful appointment check-in so the
   * PrintBadgeModal can render the printable pass in-shell. The backend
   * no longer ships a PDF — the FE renders from session snapshots +
   * `badgeQrToken` instead. Cleared when the modal is dismissed.
   */
  const [badgePrintTarget, setBadgePrintTarget] =
    useState<PrintBadgeModalData | null>(null);

  /**
   * Pending bulk-action modal state. Buttons only appear when the
   * selection is uniformly eligible for the action, so by the time we
   * open this modal every id in `ids` is guaranteed to be a valid
   * target — no `skipped` disclosure needed.
   */
  type BulkActionKind = "approve" | "reject" | "force_approve";
  const [bulkModal, setBulkModal] = useState<
    | {
        kind: BulkActionKind;
        ids: string[];
        note: string;
      }
    | null
  >(null);

  /**
   * Client-side filter pills that split the unified queue into the three
   * disjoint subsets the receptionist actually wants to act on. The
   * filter is applied to the rows passed to `<DataTable>`, so a
   * select-all on any filter view produces a homogeneous selection that
   * trivially passes the bulk-action eligibility check below.
   *
   *  - `all`          → unfiltered (default)
   *  - `ready`        → walk-in check-ins ready for approve / reject
   *  - `awaiting_id`  → walk-in check-ins still in KYC (force-approve target)
   *  - `appointments` → scheduled appointments (single-item check-in only)
   */
  type BulkFilter = "all" | "ready" | "awaiting_id" | "appointments";
  const [bulkFilter, setBulkFilter] = useState<BulkFilter>("all");

  /** Tracked here so the bulk-action array can react to homogeneity. */
  const [selectedRows, setSelectedRows] = useState<PendingApprovalItem[]>([]);

  const rows = data ?? [];

  const filteredRows = useMemo(() => {
    switch (bulkFilter) {
      case "ready":
        return rows.filter(
          (r) => r.sourceType === "checkin" && r.state === "pending_approval",
        );
      case "awaiting_id":
        return rows.filter(
          (r) =>
            r.sourceType === "checkin" && r.state === "pending_verification",
        );
      case "appointments":
        return rows.filter((r) => r.sourceType === "appointment");
      case "all":
      default:
        return rows;
    }
  }, [rows, bulkFilter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      ready: rows.filter(
        (r) => r.sourceType === "checkin" && r.state === "pending_approval",
      ).length,
      awaiting_id: rows.filter(
        (r) =>
          r.sourceType === "checkin" && r.state === "pending_verification",
      ).length,
      appointments: rows.filter((r) => r.sourceType === "appointment").length,
    }),
    [rows],
  );

  /**
   * Eligibility predicates. A bulk action button only renders when every
   * selected row passes the matching predicate — partially-eligible
   * selections never see the button at all, so the operator can never
   * trigger an action that would no-op or partially fail.
   */
  const isApprovableRow = (r: PendingApprovalItem) =>
    r.sourceType === "checkin" && r.state === "pending_approval";
  const isForceApprovableRow = (r: PendingApprovalItem) =>
    r.sourceType === "checkin" && r.state === "pending_verification";

  const selectionAllApprovable =
    selectedRows.length > 0 && selectedRows.every(isApprovableRow);
  const selectionAllForceApprovable =
    selectedRows.length > 0 && selectedRows.every(isForceApprovableRow);

  /**
   * Outcome of one attempt at `POST /v1/appointments/{id}/check-in`.
   * `prompt-required` means the backend (or our pre-check) reports a
   * missing field the receptionist must supply before retrying.
   */
  type CheckInOutcome =
    | { kind: "ok" }
    | { kind: "prompt-required"; field: AppointmentCheckInMissingField }
    | { kind: "error" };

  const submitAppointmentCheckIn = async (
    item: PendingApprovalItem,
    body: AppointmentCheckInRequest,
  ): Promise<CheckInOutcome> => {
    if (!item.appointmentId) return { kind: "error" };
    try {
      const result = await checkInFromAppointment.mutateAsync({
        appointmentId: item.appointmentId,
        body,
      });
      toast.success(`Checked in ${result.visitorProfile.fullName}`);
      if (result.badgeQrToken) {
        setBadgePrintTarget(buildBadgeData(result, item));
      }
      return { kind: "ok" };
    } catch (err) {
      const missing = readMissingFieldFromError(err);
      if (missing) return { kind: "prompt-required", field: missing };
      toast.error(
        err instanceof Error ? err.message : "Failed to check in visitor",
      );
      return { kind: "error" };
    }
  };

  const handleAppointmentCheckIn = async (item: PendingApprovalItem) => {
    if (!item.appointmentId) return;
    setBusyAppointmentId(item.appointmentId);
    // Pre-emptively prompt when the row's visitor summary already shows
    // the required field as missing — avoids the 400 round-trip.
    const knownMissing = detectKnownMissingField(item);
    if (knownMissing) {
      setPromptState({ item, field: knownMissing });
      return;
    }
    const outcome = await submitAppointmentCheckIn(item, {});
    if (outcome.kind === "prompt-required") {
      setPromptState({ item, field: outcome.field });
      return;
    }
    setBusyAppointmentId(null);
  };

  const handlePromptCancel = () => {
    setPromptState(null);
    setBusyAppointmentId(null);
  };

  const handlePromptSubmit = async (value: string) => {
    if (!promptState) return;
    const { item, field } = promptState;
    const overrideBody: AppointmentCheckInRequest =
      field === "phone" ? { phone: value } : { fullName: value };
    const outcome = await submitAppointmentCheckIn(item, overrideBody);
    if (outcome.kind === "prompt-required") {
      // Backend now flags a *different* missing field. Swap the prompt
      // and let the receptionist supply that one too.
      setPromptState({ item, field: outcome.field });
      return;
    }
    setPromptState(null);
    setBusyAppointmentId(null);
  };

  /**
   * Super-admin recovery for a row stuck in `pending_verification`.
   * Calls `POST /v1/checkins/{id}/force-approve-pending`; on success the
   * pending-approvals query is invalidated by the hook and the row's
   * action set re-enables once the new state arrives.
   */
  const handleForceApprove = async (checkinId: string, visitorName: string) => {
    setBusyForceApproveId(checkinId);
    try {
      await forceApprove.mutateAsync(checkinId);
      toast.success(`Moved ${visitorName} to pending approval`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not move check-in to pending approval",
      );
    } finally {
      setBusyForceApproveId(null);
    }
  };

  /**
   * Open the bulk-action modal. The action buttons that call this are
   * only rendered when the selection is uniformly eligible, so we can
   * assume every selected row has a `checkinId` here.
   */
  const openBulkModal = (
    kind: BulkActionKind,
    selected: PendingApprovalItem[],
  ) => {
    const ids = selected
      .map((row) => row.checkinId ?? row.id)
      .filter((id): id is string => !!id);
    if (ids.length === 0) return;
    setBulkModal({ kind, ids, note: "" });
  };

  const closeBulkModal = () => setBulkModal(null);

  const bulkPending =
    bulkApprove.isPending || bulkReject.isPending || bulkForceApprove.isPending;

  const handleBulkConfirm = async () => {
    if (!bulkModal) return;
    const { kind, ids, note } = bulkModal;
    const trimmed = note.trim();
    try {
      const result =
        kind === "approve"
          ? await bulkApprove.mutateAsync({
              ids,
              notes: trimmed.length > 0 ? trimmed : undefined,
            })
          : kind === "reject"
            ? await bulkReject.mutateAsync({
                ids,
                reason: trimmed.length > 0 ? trimmed : undefined,
              })
            : await bulkForceApprove.mutateAsync({ ids });
      const verb =
        kind === "approve"
          ? "approved"
          : kind === "reject"
            ? "rejected"
            : "moved to pending approval";
      const { tone, message } = summarizeBulkResult(result, "check-in", verb);
      toast[tone](message);
      closeBulkModal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Bulk action failed",
      );
    }
  };

  /**
   * Bulk-action buttons rendered above the table when a selection is
   * non-empty AND uniformly eligible for the action. Mixed selections
   * (e.g. one walk-in + one appointment) hide every action so the
   * operator can never trigger a partial / no-op bulk request — the
   * filter pills above the table are the intended way to narrow the
   * view down before selecting.
   *
   * Force-approve is additionally gated to super_admin (matches the
   * single-item action and the backend capability).
   */
  const bulkActions: DataTableBulkAction<PendingApprovalItem>[] = useMemo(() => {
    const actions: DataTableBulkAction<PendingApprovalItem>[] = [];
    if (selectionAllApprovable) {
      actions.push({
        label: "Approve",
        description:
          "Approve every selected walk-in check-in and notify their hosts.",
        icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
        onClick: (_ids, selected) => openBulkModal("approve", selected),
        disabled: bulkPending,
      });
      actions.push({
        label: "Reject",
        description:
          "Deny entry for every selected walk-in check-in, notify their hosts, and record the shared reason on each row.",
        icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
        variant: "destructive",
        onClick: (_ids, selected) => openBulkModal("reject", selected),
        disabled: bulkPending,
      });
    }
    if (isSuperAdmin && selectionAllForceApprovable) {
      actions.push({
        label: "Force-approve pending",
        description:
          "Unstick every selected check-in that's stuck in ID verification — moves them to the pending approval queue so reception can action them.",
        icon: <Unlock className="h-4 w-4" aria-hidden="true" />,
        variant: "outline",
        onClick: (_ids, selected) => openBulkModal("force_approve", selected),
        disabled: bulkPending,
      });
    }
    return actions;
    // openBulkModal closes over stable hook mutators; only the
    // homogeneity flags, super-admin gate, and pending flag actually
    // need to invalidate the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSuperAdmin,
    bulkPending,
    selectionAllApprovable,
    selectionAllForceApprovable,
  ]);

  const columns: ColumnDef<PendingApprovalItem>[] = useMemo(
    () => [
      {
        accessorKey: "visitorName",
        id: "visitorName",
        header: "Visitor",
        cell: ({ row }) => (
          <div className="flex items-center gap-3 min-w-0">
            {row.original.photoUrl ? (
              <Image
                src={row.original.photoUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover border"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{row.original.visitorName}</p>
              {row.original.company && (
                <p className="text-xs text-muted-foreground truncate">
                  {row.original.company}
                </p>
              )}
            </div>
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "sourceType",
        id: "sourceType",
        header: "Source",
        cell: ({ row }) => {
          const item = row.original;
          if (item.sourceType === "appointment") {
            return (
              <Badge variant="info" className="gap-1">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                Appointment
              </Badge>
            );
          }
          if (item.state === "pending_verification") {
            return (
              <Badge
                variant="outline"
                className="gap-1 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                Awaiting ID verification
              </Badge>
            );
          }
          return (
            <Badge variant="warning" className="gap-1">
              <UserCheck className="h-3 w-3" aria-hidden="true" />
              Walk-in
            </Badge>
          );
        },
      },
      {
        accessorKey: "purpose",
        id: "purpose",
        header: "Purpose",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.purpose ?? "—"}</span>
        ),
      },
      {
        accessorKey: "verified",
        id: "verified",
        header: "ID",
        cell: ({ row }) => (
          <IdentityCheckBadge
            identityCheck={row.original.identityCheck}
            verified={row.original.verified}
          />
        ),
      },
      ...(showBranch
        ? [
            {
              id: "branch",
              header: "Branch",
              cell: ({ row }) => (
                <BranchLabel branch={row.original.branchSummary} />
              ),
            } as ColumnDef<PendingApprovalItem>,
          ]
        : []),
      {
        id: "when",
        header: "When",
        cell: ({ row }) => {
          const item = row.original;
          const ts =
            item.sourceType === "appointment"
              ? item.scheduledDatetime ?? item.createdAt
              : item.createdAt;
          return (
            <span className="text-muted-foreground text-sm">
              {formatDateTime(ts)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          if (item.sourceType === "appointment") {
            const appointmentId = item.appointmentId ?? "";
            const isBusy = busyAppointmentId === appointmentId;
            return (
              <div className="flex justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => handleAppointmentCheckIn(item)}
                      disabled={isBusy || !appointmentId}
                      className="min-h-[44px] md:min-h-0"
                    >
                      {isBusy ? (
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      Check in
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Issue this visitor a badge from their scheduled appointment
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          }

          const checkinId = item.checkinId ?? item.id;
          const approveHref = checkinConfirmHref(checkinId, "approve");
          const rejectHref = checkinConfirmHref(checkinId, "reject");
          const viewHref = checkinDetailHref(checkinId);
          const isAwaitingVerification = item.state === "pending_verification";
          const stuck = isStuckInPendingVerification(item);
          const isBusyForceApprove = busyForceApproveId === checkinId;
          return (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 min-h-[44px] md:min-h-0"
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Open actions for this check-in
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuNavItem
                  href={viewHref}
                  label="View details"
                  icon={<Eye className="h-4 w-4" aria-hidden="true" />}
                />
                <DropdownMenuSeparator />
                {isAwaitingVerification ? (
                  <>
                    <DropdownMenuItem disabled className="flex items-center">
                      <CheckCircle2
                        className="mr-2 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="flex flex-col">
                        <span>Approve</span>
                        <span className="text-xs text-muted-foreground">
                          Visitor is completing their ID check at the kiosk
                        </span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled className="flex items-center">
                      <XCircle
                        className="mr-2 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Reject
                    </DropdownMenuItem>
                    {isSuperAdmin && stuck && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            void handleForceApprove(
                              checkinId,
                              item.visitorName,
                            );
                          }}
                          disabled={isBusyForceApprove}
                          className="flex items-center"
                        >
                          {isBusyForceApprove ? (
                            <Loader2
                              className="mr-2 h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Unlock
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                          )}
                          <span className="flex flex-col">
                            <span>Force-approve pending</span>
                            <span className="text-xs text-muted-foreground">
                              Stuck for over 10 minutes — move to Pending
                              approval
                            </span>
                          </span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <DropdownMenuNavItem
                      href={approveHref}
                      label="Approve"
                      icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                    />
                    <DropdownMenuNavItem
                      href={rejectHref}
                      label="Reject"
                      destructive
                      icon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                    />
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      busyAppointmentId,
      busyForceApproveId,
      handleNavClick,
      isSuperAdmin,
      loadingHref,
      showBranch,
    ],
  );

  const mobileCard = (item: PendingApprovalItem): ReactNode => {
    if (item.sourceType === "appointment") {
      const appointmentId = item.appointmentId ?? "";
      const isBusy = busyAppointmentId === appointmentId;
      const ts = item.scheduledDatetime ?? item.createdAt;
      return (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex items-center gap-3">
              {item.photoUrl ? (
                <Image
                  src={item.photoUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover border"
                />
              ) : (
                <div
                  className="h-9 w-9 rounded-full bg-muted"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{item.visitorName}</p>
                {item.purpose && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.purpose}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="info" className="gap-1 shrink-0">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              Scheduled
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Scheduled for {formatDateTime(ts)}
          </div>
          {showBranch && item.branchSummary?.name && (
            <div className="text-xs text-muted-foreground">
              Branch: {item.branchSummary.name}
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={() => handleAppointmentCheckIn(item)}
                disabled={isBusy || !appointmentId}
                className="w-full min-h-[44px]"
              >
                {isBusy ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Check in
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Issue this visitor a badge from their scheduled appointment
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    const checkinId = item.checkinId ?? item.id;
    const approveHref = checkinConfirmHref(checkinId, "approve");
    const rejectHref = checkinConfirmHref(checkinId, "reject");
    const viewHref = checkinDetailHref(checkinId);
    const isAwaitingVerification = item.state === "pending_verification";
    const stuck = isStuckInPendingVerification(item);
    const isBusyForceApprove = busyForceApproveId === checkinId;
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-3">
            {item.photoUrl ? (
              <Image
                src={item.photoUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover border"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{item.visitorName}</p>
              {item.purpose && (
                <p className="text-xs text-muted-foreground truncate">
                  {item.purpose}
                </p>
              )}
            </div>
          </div>
          {isAwaitingVerification ? (
            <Badge
              variant="outline"
              className="gap-1 shrink-0 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              Awaiting ID
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1 shrink-0">
              <UserCheck className="h-3 w-3" aria-hidden="true" />
              Walk-in
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Submitted {formatDateTime(item.createdAt)}
        </div>
        {showBranch && item.branchSummary?.name && (
          <div className="text-xs text-muted-foreground">
            Branch: {item.branchSummary.name}
          </div>
        )}
        {isAwaitingVerification && (
          <p className="text-xs text-muted-foreground">
            Visitor is completing their ID check at the kiosk. Approve and
            reject unlock once verification finishes.
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={viewHref}
                size="sm"
                variant="outline"
                className="min-h-[44px]"
              >
                {loadingHref === viewHref ? (
                  <Loader2
                    className="mr-1 h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                )}
                Details
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Open the full details for this check-in
            </TooltipContent>
          </Tooltip>
          {isAwaitingVerification ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <Button
                      size="sm"
                      disabled
                      className="w-full min-h-[44px]"
                    >
                      <CheckCircle2
                        className="mr-1 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Approve
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Disabled until the visitor finishes ID verification
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled
                      className="min-h-[44px]"
                    >
                      <XCircle
                        className="mr-1 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Reject
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Disabled until the visitor finishes ID verification
                </TooltipContent>
              </Tooltip>
              {isSuperAdmin && stuck && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleForceApprove(checkinId, item.visitorName)
                      }
                      disabled={isBusyForceApprove}
                      className="w-full min-h-[44px]"
                    >
                      {isBusyForceApprove ? (
                        <Loader2
                          className="mr-1 h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Unlock
                          className="mr-1 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )}
                      Force-approve pending
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Stuck for over 10 minutes — move this check-in to
                    Pending approval so reception can action it
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavButton
                    href={approveHref}
                    size="sm"
                    className="flex-1 min-h-[44px]"
                  >
                    {loadingHref === approveHref ? (
                      <Loader2
                        className="mr-1 h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="mr-1 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    )}
                    Approve
                  </NavButton>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Let this visitor in and issue a badge
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavButton
                    href={rejectHref}
                    size="sm"
                    variant="destructive"
                    className="min-h-[44px]"
                  >
                    {loadingHref === rejectHref ? (
                      <Loader2
                        className="mr-1 h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle
                        className="mr-1 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    )}
                    Reject
                  </NavButton>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Deny this visitor entry and notify their host
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    );
  };

  const filterPills: Array<{
    id: BulkFilter;
    label: string;
    tooltip: string;
    count: number;
    show: boolean;
  }> = [
    {
      id: "all",
      label: "All",
      tooltip: "Show every row in the queue regardless of type or state",
      count: counts.all,
      show: true,
    },
    {
      id: "ready",
      label: "Walk-ins ready",
      tooltip:
        "Walk-in check-ins ready for approve or reject. Select all to action them in bulk.",
      count: counts.ready,
      show: true,
    },
    {
      id: "awaiting_id",
      label: "Awaiting ID",
      tooltip:
        "Walk-in check-ins still completing ID verification at the kiosk. Super admins can force these into the approval queue in bulk.",
      count: counts.awaiting_id,
      show: counts.awaiting_id > 0 || bulkFilter === "awaiting_id",
    },
    {
      id: "appointments",
      label: "Appointments",
      tooltip:
        "Scheduled appointments awaiting check-in. These must be checked in one at a time — bulk actions don't apply.",
      count: counts.appointments,
      show: counts.appointments > 0 || bulkFilter === "appointments",
    },
  ];

  return (
    <>
      <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter queue"
      >
        {filterPills
          .filter((pill) => pill.show)
          .map((pill) => {
            const active = bulkFilter === pill.id;
            return (
              <Tooltip key={pill.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setBulkFilter(pill.id)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-full text-[10px] font-semibold h-4 min-w-[16px] px-1",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {pill.count}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{pill.tooltip}</TooltipContent>
              </Tooltip>
            );
          })}
      </div>

      {bulkFilter === "appointments" && counts.appointments > 0 && (
        <p
          className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground"
          role="status"
        >
          Appointments must be checked in one at a time so the receptionist
          can supply missing fields per visitor. Use the row-level{" "}
          <strong>Check in</strong> button instead.
        </p>
      )}

      <DataTable
        columns={columns}
        data={filteredRows}
        isLoading={isLoading}
        searchKey="visitorName"
        searchPlaceholder="Search by visitor name..."
        pagination
        pageSize={10}
        mobileCard={mobileCard}
        emptyTitle="No pending approvals"
        emptyDescription="Walk-in submissions and scheduled appointments appear here automatically."
        selectable
        getRowId={(row) => row.id}
        itemNoun="check-in"
        bulkActions={bulkActions}
        onSelectionChange={(_ids, rows) => setSelectedRows(rows)}
        getRowHref={(item) =>
          item.sourceType === "checkin" ? checkinDetailHref(item.id) : undefined
        }
        rowClickAriaLabel={(item) =>
          item.sourceType === "checkin"
            ? `View check-in details for ${item.visitorName}`
            : `Check in appointment for ${item.visitorName}`
        }
      />
      </div>
      <AppointmentCheckInPromptModal
        open={!!promptState}
        field={promptState?.field ?? "phone"}
        visitorName={promptState?.item.visitorName ?? ""}
        isSubmitting={checkInFromAppointment.isPending}
        onCancel={handlePromptCancel}
        onSubmit={(value) => void handlePromptSubmit(value)}
      />
      <BulkActionModal
        state={bulkModal}
        onClose={closeBulkModal}
        onNoteChange={(value) =>
          setBulkModal((prev) => (prev ? { ...prev, note: value } : prev))
        }
        onConfirm={() => void handleBulkConfirm()}
        isSubmitting={bulkPending}
      />
      <PrintBadgeModal
        open={badgePrintTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBadgePrintTarget(null);
        }}
        badge={
          badgePrintTarget ?? {
            visitorName: "",
            statusLabel: "Checked in",
            qrToken: "",
          }
        }
      />
    </>
  );
}

interface BulkActionModalState {
  kind: "approve" | "reject" | "force_approve";
  ids: string[];
  note: string;
}

interface BulkActionModalProps {
  state: BulkActionModalState | null;
  onClose: () => void;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

/**
 * Modal that confirms a bulk approve / reject / force-approve action on
 * the pending approvals queue. Renders an optional `notes` textarea for
 * approve and a `reason` textarea for reject (both capped at the backend
 * limit of 500 chars); force-approve takes no extra input.
 */
function BulkActionModal({
  state,
  onClose,
  onNoteChange,
  onConfirm,
  isSubmitting,
}: BulkActionModalProps) {
  const REASON_MAX = 500;
  const open = !!state;
  const kind = state?.kind ?? "approve";
  const count = state?.ids.length ?? 0;
  const note = state?.note ?? "";

  const noun = count === 1 ? "check-in" : "check-ins";
  const titleByKind: Record<BulkActionModalState["kind"], string> = {
    approve: `Approve ${count} ${noun}`,
    reject: `Reject ${count} ${noun}`,
    force_approve: `Force-approve ${count} stuck ${noun}`,
  };
  const descByKind: Record<BulkActionModalState["kind"], string> = {
    approve: `Approve the selected ${noun}, issue badges where the plan grants them, and notify each visitor's host.`,
    reject: `Deny entry for the selected ${noun} and notify each visitor's host. The reason below is recorded on every row.`,
    force_approve: `Move the selected ${noun} from "awaiting ID verification" into the pending approval queue so reception can action them.`,
  };
  const showNoteField = kind === "approve" || kind === "reject";
  const noteLabel =
    kind === "approve" ? "Notes (optional)" : "Reason (optional)";
  const notePlaceholder =
    kind === "approve"
      ? "Add an internal note shown on the approval audit row"
      : "e.g. Visitor was unable to confirm the host they were meeting";
  const confirmLabel =
    kind === "approve"
      ? `Approve ${count}`
      : kind === "reject"
        ? `Reject ${count}`
        : `Force-approve ${count}`;
  const confirmVariant: "default" | "destructive" =
    kind === "reject" ? "destructive" : "default";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titleByKind[kind]}</DialogTitle>
          <DialogDescription>{descByKind[kind]}</DialogDescription>
        </DialogHeader>
        {showNoteField && (
          <div className="space-y-2">
            <Label htmlFor="bulk-action-note">{noteLabel}</Label>
            <Textarea
              id="bulk-action-note"
              value={note}
              onChange={(event) =>
                onNoteChange(event.target.value.slice(0, REASON_MAX))
              }
              placeholder={notePlaceholder}
              rows={4}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground text-right">
              {note.length}/{REASON_MAX}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isSubmitting || count === 0}
            className="min-h-[44px]"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
