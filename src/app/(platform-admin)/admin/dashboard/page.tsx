import { AdminInsightsClient } from "@/features/dashboard/components/admin/admin-insights-client";

export const metadata = {
  title: "Platform Dashboard · VisiChek",
};

// The dashboard IS the Insights surface — range-aware, tabbed, interactive,
// with a live counter strip, backed by GET /v1/admins/dashboard/insights
// (+ /insights/drill) and the live SSE stream.
export default function AdminDashboardPage() {
  return <AdminInsightsClient />;
}
