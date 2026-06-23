import { NotificationsFeed } from "@/features/notifications/components/notifications-feed";

/**
 * Platform-admin notifications feed — the full-page "View all" destination
 * from the topbar bell in the admin shell (admin's own in-app notifications).
 */
export default function AdminNotificationsPage() {
  return <NotificationsFeed shell="admin" />;
}
