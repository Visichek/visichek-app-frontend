"use client";

import { Laptop, Smartphone, Tablet, MoreHorizontal, Loader2, LogOut } from "lucide-react";
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
import type { SessionOut, DeviceType } from "@/types/account";

const DEVICE_ICONS: Record<DeviceType, typeof Laptop> = {
  desktop: Laptop,
  tablet: Tablet,
  mobile: Smartphone,
  unknown: Laptop,
};

function formatSessionDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseUserAgent(ua: string): string {
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

interface SessionsTableProps {
  sessions: SessionOut[];
  onRevoke: (id: string) => void;
  revokingId: string | null;
}

export function SessionsTable({ sessions, onRevoke, revokingId }: SessionsTableProps) {
  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Device</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Location</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Created</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Last active</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((sess) => {
              const DeviceIcon = DEVICE_ICONS[sess.deviceType] ?? Laptop;
              return (
                <tr key={sess.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {parseUserAgent(sess.userAgent)}
                      {sess.isCurrent && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sess.location ?? sess.ipAddress}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatSessionDate(sess.dateCreated)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatSessionDate(sess.lastActiveAt)}</td>
                  <td className="px-4 py-3">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {sessions.map((sess) => {
          const DeviceIcon = DEVICE_ICONS[sess.deviceType] ?? Laptop;
          return (
            <div key={sess.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {parseUserAgent(sess.userAgent)}
                  {sess.isCurrent && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Current
                    </span>
                  )}
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
                        {revokingId === sess.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Revoke"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>End this session</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Location: {sess.location ?? sess.ipAddress}</span>
                <span>Created: {formatSessionDate(sess.dateCreated)}</span>
                <span className="col-span-2">Last active: {formatSessionDate(sess.lastActiveAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
