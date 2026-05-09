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
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";

import { DataTable } from "@/components/recipes/data-table";
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
import { usePendingApprovals } from "@/features/checkins/hooks";
import { useCheckInFromAppointment } from "@/features/appointments/hooks/use-appointments";
import type { PendingApprovalItem } from "@/types/checkin";

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
  const checkInFromAppointment = useCheckInFromAppointment();
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);

  const rows = data ?? [];

  const handleAppointmentCheckIn = async (item: PendingApprovalItem) => {
    if (!item.appointmentId) return;
    setBusyAppointmentId(item.appointmentId);
    try {
      const result = await checkInFromAppointment.mutateAsync({
        appointmentId: item.appointmentId,
        body: {},
      });
      toast.success(`Checked in ${result.visitorProfile.fullName}`);
      if (result.badgePdfBase64) {
        const safeName = result.visitorProfile.fullName
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .toLowerCase();
        downloadBadgePdf(result.badgePdfBase64, `badge-${safeName || "visitor"}.pdf`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to check in visitor",
      );
    } finally {
      setBusyAppointmentId(null);
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
        cell: ({ row }) =>
          row.original.sourceType === "appointment" ? (
            <Badge variant="info" className="gap-1">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              Appointment
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1">
              <UserCheck className="h-3 w-3" aria-hidden="true" />
              Walk-in
            </Badge>
          ),
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
                <DropdownMenuItem asChild>
                  <Link
                    href={viewHref}
                    onClick={() => handleNavClick(viewHref)}
                    className="flex items-center"
                  >
                    {loadingHref === viewHref ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    View details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={approveHref}
                    onClick={() => handleNavClick(approveHref)}
                    className="flex items-center"
                  >
                    {loadingHref === approveHref ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                    Approve
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={rejectHref}
                    onClick={() => handleNavClick(rejectHref)}
                    className="flex items-center text-destructive"
                  >
                    {loadingHref === rejectHref ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Reject
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [busyAppointmentId, handleNavClick, loadingHref],
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
          <Badge variant="warning" className="gap-1 shrink-0">
            <UserCheck className="h-3 w-3" aria-hidden="true" />
            Walk-in
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Submitted {formatDateTime(item.createdAt)}
        </div>
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
        </div>
      </div>
    );
  };

  return (
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
  );
}
