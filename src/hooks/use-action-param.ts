"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads the `?action=` query param on mount and runs the supplied callback if
 * the value matches one of the configured action keys. The param is then
 * cleared from the URL so a refresh does not re-trigger the action.
 *
 * Used to let dashboard "Quick Action" cards deep-link into a destination page
 * and immediately open a create/edit modal:
 *
 *   /admin/tenants?action=create  -> opens BootstrapTenantModal
 *
 * @example
 * useActionParam({
 *   create: () => setCreateModalOpen(true),
 *   "add-admin": () => setAddAdminOpen(true),
 * });
 */
export function useActionParam(handlers: Record<string, () => void>): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;
    if (handledRef.current === action) return;

    const handler = handlers[action];
    if (!handler) return;

    handledRef.current = action;
    handler();

    // Strip the action param from the URL so refresh does not re-trigger.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("action");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // We intentionally only depend on the search string so handlers can be
    // recreated on every render without re-firing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
