"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Laptop,
  Smartphone,
  Tablet,
  MoreHorizontal,
  Loader2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { DataTable } from "@/components/recipes/data-table";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import type { SessionOut, DeviceType } from "@/types/account";

const DEVICE_ICONS: Record<DeviceType, typeof Laptop> = {
  desktop: Laptop,
  tablet: Tablet,
  mobile: Smartphone,
  unknown: Laptop,
};

function formatSessionDate(unixSeconds: number | null | undefined): string {
  // Legacy rows can carry a null timestamp — render a dash instead of
  // "Jan 1, 1970".
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseUserAgent(ua: string | null | undefined): string {
  // user_agent is Optional on the backend; a null here used to crash the
  // whole settings tab.
  if (!ua) return "Unknown device";

  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("iPhone")) os = "iOS";
  else if (ua.includes("iPad")) os = "iPadOS";
  else if (ua.includes("Android")) os = "Android";

  return os ? `${browser} (${os})` : browser;
}

/** Server label first — it has richer UA data; client parse is the fallback. */
function deviceLabel(sess: SessionOut): string {
  return sess.device ?? parseUserAgent(sess.userAgent);
}

function locationLabel(sess: SessionOut): string {
  return sess.location ?? sess.ipAddress ?? "Unknown";
}

function CurrentBadge() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
      Current
    </span>
  );
}

interface SessionsTableProps {
  sessions: SessionOut[];
  onRevoke: (id: string) => void;
  /** Bulk revoke for a multi-selection; current session is never included. */
  onRevokeMany: (ids: string[]) => void;
  revokingId: string | null;
  isRevokingMany: boolean;
}

export function SessionsTable({
  sessions,
  onRevoke,
  onRevokeMany,
  revokingId,
  isRevokingMany,
}: SessionsTableProps) {
  const [pendingBulkIds, setPendingBulkIds] = React.useState<string[] | null>(
    null
  );

  // Pin the current session to the top, then most-recently-active first.
  const sorted = React.useMemo(
    () =>
      [...sessions].sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0);
      }),
    [sessions]
  );

  const columns = React.useMemo<ColumnDef<SessionOut, unknown>[]>(
    () => [
      {
        id: "device",
        header: "Device",
        cell: ({ row }) => {
          const sess = row.original;
          const DeviceIcon = DEVICE_ICONS[sess.deviceType] ?? Laptop;
          return (
            <span className="flex items-center gap-2 font-medium">
              <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              {deviceLabel(sess)}
              {sess.isCurrent && <CurrentBadge />}
            </span>
          );
        },
      },
      {
        id: "location",
        header: "Location / IP",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {locationLabel(row.original)}
          </span>
        ),
      },
      {
        id: "created",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatSessionDate(row.original.dateCreated)}
          </span>
        ),
      },
      {
        id: "lastActive",
        header: "Last active",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatSessionDate(row.original.lastActiveAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const sess = row.original;
          return (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      {revokingId === sess.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Session actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onRevoke(sess.id)}
                  className="text-destructive focus:text-destructive gap-2"
                  disabled={sess.isCurrent}
                >
                  <LogOut className="h-4 w-4" />
                  {sess.isCurrent ? "Current session" : "Revoke session"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onRevoke, revokingId]
  );

  return (
    <>
      <DataTable<SessionOut, unknown>
        columns={columns}
        data={sorted}
        pagination={sorted.length > 10}
        selectable
        getRowId={(sess) => sess.id}
        itemNoun="session"
        bulkActions={[
          {
            label: "Revoke",
            description:
              "Sign out of the selected sessions on those devices immediately",
            icon: <LogOut className="h-4 w-4" />,
            variant: "destructive",
            isLoading: isRevokingMany,
            onClick: (selectedIds, selectedRows) => {
              // Never bulk-revoke the session the user is on — that's what
              // the explicit "Log out of all devices" button is for.
              const ids = selectedRows
                .filter((sess) => !sess.isCurrent)
                .map((sess) => sess.id);
              if (ids.length > 0) setPendingBulkIds(ids);
            },
          },
        ]}
        emptyTitle="No active sessions"
        emptyDescription="Sessions appear here when you sign in on a device."
        mobileCard={(sess) => {
          const DeviceIcon = DEVICE_ICONS[sess.deviceType] ?? Laptop;
          return (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {deviceLabel(sess)}
                  {sess.isCurrent && <CurrentBadge />}
                </p>
                {!sess.isCurrent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8"
                        onClick={() => onRevoke(sess.id)}
                        disabled={revokingId === sess.id}
                      >
                        {revokingId === sess.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Revoke"
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>End this session</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Location: {locationLabel(sess)}</span>
                <span>Created: {formatSessionDate(sess.dateCreated)}</span>
                <span className="col-span-2">
                  Last active: {formatSessionDate(sess.lastActiveAt)}
                </span>
              </div>
            </div>
          );
        }}
      />

      <ConfirmDialog
        open={pendingBulkIds !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBulkIds(null);
        }}
        title="Revoke selected sessions?"
        description={`Revoke ${pendingBulkIds?.length ?? 0} session(s)? Those devices will be signed out immediately. Your current session is never included.`}
        confirmLabel="Revoke sessions"
        variant="destructive"
        isLoading={isRevokingMany}
        onConfirm={() => {
          if (pendingBulkIds && pendingBulkIds.length > 0) {
            onRevokeMany(pendingBulkIds);
          }
          setPendingBulkIds(null);
        }}
      />
    </>
  );
}
