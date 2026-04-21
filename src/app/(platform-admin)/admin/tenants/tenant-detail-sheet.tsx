// DEPRECATED — tenant detail is now a dedicated page at /admin/tenants/{id}.
// Use `TenantDetailView` from `@/features/auth/components/tenant-detail-view`
// or link to `/admin/tenants/{id}` directly. This no-op stub keeps any
// straggling imports compiling until all call sites are cleaned up.

import type { AdminTenant } from "@/types/admin";

interface TenantDetailSheetProps {
  tenant: AdminTenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * @deprecated Navigate to `/admin/tenants/{id}` instead. Rendering this
 * component now produces nothing.
 */
export function TenantDetailSheet(_props: TenantDetailSheetProps) {
  void _props;
  return null;
}
