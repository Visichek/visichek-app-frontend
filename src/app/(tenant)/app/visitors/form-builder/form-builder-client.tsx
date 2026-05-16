"use client";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { FormBuilder } from "@/features/tenant-forms/components/form-builder";

/**
 * Client wrapper that gates the visitor form-builder behind the
 * `TENANT_FORM_CONFIGURE` capability (Issue 3).
 *
 * super_admin and dept_admin both have this capability; receptionist
 * and the other tenant roles do not. The route is also wrapped by
 * AuthGuard at the shell layer — this component is the second line of
 * defence that swaps to a permission-denied state when a lower-
 * privileged role lands on the URL directly.
 *
 * Backend mutation routes (Issue 3 backend task) replace the
 * super-admin-only auth dependency with the matching server-side
 * permission, so the gate is authoritative on the server too.
 */
export function FormBuilderClient() {
  const { isBootstrapping } = useSession();
  const { hasCapability } = useCapabilities();

  if (isBootstrapping) {
    // The shell-level skeletons cover the bootstrap; render nothing here so
    // we don't double-flicker.
    return null;
  }

  if (!hasCapability(CAPABILITIES.TENANT_FORM_CONFIGURE)) {
    return (
      <PermissionDenied message="Only your tenant's super admin or a department admin can configure visitor forms. Contact them if this view is wrong." />
    );
  }

  return (
    <FormBuilder
      defaultTarget="checkin"
      backHref="/app/visitors"
      backLabel="Back to visitors"
    />
  );
}
