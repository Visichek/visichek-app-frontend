"use client";

/**
 * TODO — Backend endpoints needed before this page is functional:
 *
 * GET    /v1/notifications              — list notifications (paginated, filterable by read/unread)
 * PATCH  /v1/notifications/{id}/read    — mark notification as read
 * POST   /v1/notifications/read-all     — mark all as read
 * GET    /v1/notifications/unread-count — for topbar badge count
 * DELETE /v1/notifications/{id}         — dismiss notification
 *
 * See TODO-backend-alerts.md for full spec.
 */

import { BellOff } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="View notifications and system alerts"
      />

      <EmptyState
        icon={<BellOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
        title="No alerts yet"
        description="When there are notifications or system alerts, they'll appear here."
      />
    </div>
  );
}
