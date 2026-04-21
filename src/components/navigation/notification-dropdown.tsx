"use client";

import { useRef, useEffect, useState } from "react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from "@/features/notifications/hooks";
import type { NotificationType } from "@/types/notification";

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: typeof Info; className: string }
> = {
  info: { icon: Info, className: "text-blue-500" },
  warning: { icon: AlertTriangle, className: "text-amber-500" },
  error: { icon: AlertCircle, className: "text-destructive" },
  success: { icon: CheckCircle2, className: "text-emerald-500" },
};

function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

/**
 * Bell icon with a one-shot upward pop when unread count increases.
 * Does NOT loop — fires once per new batch and stops.
 * Skips animation on initial mount and when count decreases.
 * Respects prefers-reduced-motion.
 */
function AnimatedBell({ unreadCount }: { unreadCount: number }) {
  const prevCountRef = useRef<number | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = unreadCount;

    // Skip first mount (prev is null) and any decrease
    if (prev === null || unreadCount <= prev) return;

    // Bumping the key remounts the span and replays the CSS animation
    setAnimationKey((k) => k + 1);
  }, [unreadCount]);

  return (
    <span
      key={animationKey}
      className={
        animationKey === 0
          ? "inline-flex items-center justify-center"
          : reducedMotion
            ? "inline-flex items-center justify-center animate-bell-pulse"
            : "inline-flex items-center justify-center animate-bell-pop"
      }
    >
      <Bell className="h-5 w-5" />
    </span>
  );
}

/**
 * Badge that scales in when it first appears and does a crisp
 * number-update transition when count changes.
 */
function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      key={count}
      className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-badge-pop"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationDropdown() {
  const { navigate } = useNavigationLoading();

  const { data: unreadData } = useUnreadCount();
  const {
    data: notifications,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useNotifications({
    limit: 10,
  });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const unreadCount = unreadData?.count ?? 0;

  const handleNotificationClick = (
    id: string,
    link?: string | null,
    read?: boolean
  ) => {
    if (!read) {
      markAsRead.mutate(id);
    }
    if (link) {
      navigate(link);
    }
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative min-h-[44px] min-w-[44px]"
              aria-label={`View notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            >
              <AnimatedBell unreadCount={unreadCount} />
              {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          View your notifications and alerts
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent className="w-80 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    markAllAsRead.mutate();
                  }}
                  disabled={markAllAsRead.isPending}
                >
                  {markAllAsRead.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3 w-3 mr-1" />
                  )}
                  Mark all read
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark all notifications as read</TooltipContent>
            </Tooltip>
          )}
        </div>

        <Separator />

        {/* Notification list */}
        <div className="max-h-[360px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive/70" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Couldn&apos;t load notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : "Please try again in a moment."}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={(e) => {
                      e.preventDefault();
                      refetch();
                    }}
                    disabled={isRefetching}
                  >
                    {isRefetching ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                    )}
                    Retry
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Retry fetching your recent notifications
                </TooltipContent>
              </Tooltip>
            </div>
          ) : !notifications?.length ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const config =
                TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.info;
              const Icon = config.icon;
              // Error-type notifications (e.g. failed queued writes) deserve
              // a stronger visual cue than "info" or "success".
              const isError = notification.type === "error";

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer border-b last:border-0 border-l-2 border-l-transparent",
                    !notification.read && !isError && "bg-primary/[0.03]",
                    isError && "border-l-destructive bg-destructive/[0.04]",
                  )}
                  onClick={() =>
                    handleNotificationClick(
                      notification.id,
                      notification.link,
                      notification.read
                    )
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(
                        notification.id,
                        notification.link,
                        notification.read
                      );
                    }
                  }}
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon className={cn("h-4 w-4", config.className)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm leading-tight",
                          !notification.read && "font-medium"
                        )}
                      >
                        {notification.title}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification.mutate(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatRelativeTime(notification.dateCreated)}
                    </p>
                  </div>
                  {!notification.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
