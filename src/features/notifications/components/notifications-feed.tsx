"use client";

import { useEffect, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useNotifications,
  useNotificationSummaryData,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from "@/features/notifications/hooks";
import { resolveNotificationRoute } from "@/lib/notifications/route-resolver";
import type { NotificationType } from "@/types/notification";

type FeedShell = "tenant" | "admin";
type ReadFilter = "all" | "unread";

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: typeof Info; className: string }
> = {
  info: { icon: Info, className: "text-blue-500" },
  warning: { icon: AlertTriangle, className: "text-amber-500" },
  error: { icon: AlertCircle, className: "text-destructive" },
  success: { icon: CheckCircle2, className: "text-emerald-500" },
};

const PAGE_SIZE = 20;

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
 * Full-page notification feed for both shells. Mirrors the topbar bell
 * dropdown but with read-status tabs, pagination, and per-row open/delete —
 * the "View all" destination the bell links to. Reuses the same hooks so the
 * unread badge, summary, and SSE-driven invalidation stay in lockstep.
 */
export function NotificationsFeed({ shell }: { shell: FeedShell }) {
  const { loadingHref, navigate } = useNavigationLoading();
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [page, setPage] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const audience = shell === "admin" ? "admin" : "tenant";
  const { total: unreadCount } = useNotificationSummaryData(audience);

  const {
    data: notifications,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    isRefetching,
  } = useNotifications({
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    read: readFilter === "unread" ? false : undefined,
  });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const items = notifications ?? [];
  // The list endpoint returns a flat page; a full page implies there may be
  // more. Good enough for prev/next without a server total.
  const hasMore = items.length === PAGE_SIZE;

  // Clear the loading marker once navigation settles.
  useEffect(() => {
    if (!loadingHref && openingId) setOpeningId(null);
  }, [loadingHref, openingId]);

  function changeFilter(next: ReadFilter) {
    setReadFilter(next);
    setPage(0);
  }

  function handleOpen(id: string, link?: string | null, read?: boolean) {
    if (!read) markAsRead.mutate(id);
    if (!link) return;
    const target = resolveNotificationRoute(link, audience);
    if (!target) return;
    setOpeningId(id);
    navigate(target);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Every alert sent to you — incidents, visitors, compliance, billing, and more."
        actions={
          unreadCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                  className="min-h-[44px]"
                >
                  {markAllAsRead.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Mark all read
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Mark every notification as read
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      />

      <Tabs value={readFilter} onValueChange={(v) => changeFilter(v as ReadFilter)}>
        <TabsList>
          <TabsTrigger value="all" className="min-h-[44px]">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="min-h-[44px]">
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 text-xs text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/70" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Couldn&apos;t load notifications</p>
              <p className="text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Please try again in a moment."}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="min-h-[44px]"
                >
                  {isRefetching ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3 w-3" aria-hidden="true" />
                  )}
                  Retry
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry fetching your notifications</TooltipContent>
            </Tooltip>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Bell className="mb-2 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {readFilter === "unread"
                ? "You're all caught up — no unread notifications."
                : "No notifications yet."}
            </p>
          </div>
        ) : (
          items.map((notification) => {
            const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.info;
            const Icon = config.icon;
            const isOpening = openingId === notification.id;
            const isErrorType = notification.type === "error";
            return (
              <div
                key={notification.id}
                className={cn(
                  "flex gap-3 border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/50",
                  notification.link && "cursor-pointer",
                  !notification.read && !isErrorType && "bg-primary/[0.03]",
                  isErrorType && "border-l-2 border-l-destructive bg-destructive/[0.04]",
                )}
                onClick={() =>
                  !openingId &&
                  handleOpen(notification.id, notification.link, notification.read)
                }
                role={notification.link ? "button" : undefined}
                tabIndex={notification.link ? 0 : undefined}
                onKeyDown={(e) => {
                  if (openingId || (e.key !== "Enter" && e.key !== " ")) return;
                  e.preventDefault();
                  handleOpen(notification.id, notification.link, notification.read);
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {isOpening ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  ) : (
                    <Icon className={cn("h-4 w-4", config.className)} aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm leading-tight", !notification.read && "font-medium")}>
                      {notification.title}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100"
                          aria-label="Delete notification"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification.mutate(notification.id);
                          }}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Delete this notification
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
                    {notification.body}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/70">
                      {formatRelativeTime(notification.dateCreated)}
                    </span>
                    {!notification.read && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                        New
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination — only meaningful once there's more than one page. */}
      {(page > 0 || hasMore) && !isError && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1}
            {isFetching && (
              <Loader2 className="ml-2 inline h-3 w-3 animate-spin" aria-hidden="true" />
            )}
          </p>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isFetching}
                  className="min-h-[44px]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Show the previous page of notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore || isFetching}
                  className="min-h-[44px]"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Show the next page of notifications</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
