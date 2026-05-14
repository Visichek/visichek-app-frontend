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
 *                    (handled inline; downloads badge PDF on success)
 */

import { useMemo, useState, type ReactNode } from "react";
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
  ShieldCheck,
  Unlock,
  UserCheck,
  XCircle,
} from "lucide-react";

import { DataTable } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime } from "@/lib/utils/format-date";
import {
  useForceApprovePendingCheckin,
  usePendingApprovals,
} from "@/features/checkins/hooks";
import { useCheckInFromAppointment } from "@/features/appointments/hooks/use-appointments";
import {
  AppointmentCheckInPromptModal,
  type AppointmentCheckInMissingField,
} from "@/features/appointments/components/appointment-checkin-prompt-modal";
import { useSession } from "@/hooks/use-session";
import type { PendingApprovalItem } from "@/types/checkin";
import type { AppointmentCheckInRequest } from "@/types/visitor";
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

/**
 * Decode a base64-encoded PDF and trigger a browser download. Used after
 * `POST /v1/appointments/{id}/check-in` returns a fresh badge.
 */
function downloadBadgePdf(base64: string, filename: string) {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PendingApprovalsQueue({ tenantId }: PendingApprovalsQueueProps) {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data, isLoading } = usePendingApprovals(tenantId);
  const { systemUserProfile } = useSession();
  const isSuperAdmin = systemUserProfile?.role === "super_admin";
  const checkInFromAppointment = useCheckInFromAppointment();
  const forceApprove = useForceApprovePendingCheckin();
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);
  const [busyForceApproveId, setBusyForceApproveId] = useState<string | null>(
    null,
  );
  const [promptState, setPromptState] = useState<{
    item: PendingApprovalItem;
    field: AppointmentCheckInMissingField;
  } | null>(null);

  const rows = data ?? [];

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
      if (result.badgePdfBase64) {
        const safeName = result.visitorProfile.fullName
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .toLowerCase();
        downloadBadgePdf(
          result.badgePdfBase64,
          `badge-${safeName || "visitor"}.pdf`,
        );
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

  const columns: ColumnDef<PendingApprovalItem>[] = useMemo(
    () => [
      {
        accessorKey: "visitorName",
        id: "visitorName",
        header: "Visitor",
        cell: ({ row }) => (
          <div className="flex items-center gap-3 min-w-0">
            {row.original.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.original.photoUrl}
                alt=""
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
        cell: ({ row }) =>
          row.original.verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not verified</span>
          ),
      },
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.photoUrl}
                  alt=""
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photoUrl}
                alt=""
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
        {isAwaitingVerification && (
          <p className="text-xs text-muted-foreground">
            Visitor is completing their ID check at the kiosk. Approve and
            reject unlock once verification finishes.
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="min-h-[44px]"
              >
                <Link href={viewHref} onClick={() => handleNavClick(viewHref)}>
                  {loadingHref === viewHref ? (
                    <Loader2
                      className="mr-1 h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Details
                </Link>
              </Button>
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
                  <Button size="sm" asChild className="flex-1 min-h-[44px]">
                    <Link
                      href={approveHref}
                      onClick={() => handleNavClick(approveHref)}
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
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Let this visitor in and issue a badge
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    asChild
                    className="min-h-[44px]"
                  >
                    <Link
                      href={rejectHref}
                      onClick={() => handleNavClick(rejectHref)}
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
                    </Link>
                  </Button>
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

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchKey="visitorName"
        searchPlaceholder="Search by visitor name..."
        pagination
        pageSize={10}
        mobileCard={mobileCard}
        emptyTitle="No pending approvals"
        emptyDescription="Walk-in submissions and scheduled appointments appear here automatically."
      />
      <AppointmentCheckInPromptModal
        open={!!promptState}
        field={promptState?.field ?? "phone"}
        visitorName={promptState?.item.visitorName ?? ""}
        isSubmitting={checkInFromAppointment.isPending}
        onCancel={handlePromptCancel}
        onSubmit={(value) => void handlePromptSubmit(value)}
      />
    </>
  );
}
