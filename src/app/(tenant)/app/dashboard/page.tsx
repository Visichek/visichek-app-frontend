import { TenantInsightsClient } from "@/features/dashboard/components/tenant/tenant-insights-client";

export const metadata = {
  title: "Dashboard · VisiChek",
};

// The dashboard IS the Insights surface — role-scoped, range-aware, tabbed,
// interactive, with a live counter strip, backed by GET /v1/dashboard/insights
// (+ /insights/drill) and the live SSE stream.
export default function TenantDashboardPage() {
  return <TenantInsightsClient />;
}
