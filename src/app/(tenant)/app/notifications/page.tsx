import { NotificationsFeed } from "@/features/notifications/components/notifications-feed";

/**
 * Tenant notifications feed — the full-page "View all" destination from the
 * topbar bell. Available to every tenant role (notifications are per-user).
 */
export default function NotificationsPage() {
  return <NotificationsFeed shell="tenant" />;
}
