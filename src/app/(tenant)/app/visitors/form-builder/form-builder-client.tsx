"use client";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { useSession } from "@/hooks/use-session";
import { FormBuilder } from "@/features/tenant-forms/components/form-builder";

/**
 * Client wrapper that gates the form-builder behind the super_admin role.
 *
 * Per the spec, only super_admin can configure tenant forms (CRUD). The
 * route is also wrapped by AuthGuard at the shell layer; this component is
 * a second line of defence that swaps to a permission-denied state instead
 * of redirecting if a lower-privileged role lands here.
 */
export function FormBuilderClient() {
  const { currentRole, isBootstrapping } = useSession();

  if (isBootstrapping) {
    // The shell-level skeletons cover the bootstrap; render nothing here so
    // we don't double-flicker.
    return null;
  }

  if (currentRole !== "super_admin") {
    return (
      <PermissionDenied message="Only your tenant's super admin can configure visitor forms. Contact them if this view is wrong." />
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
