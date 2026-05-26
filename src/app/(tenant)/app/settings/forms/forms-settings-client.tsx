"use client";

import { useSearchParams } from "next/navigation";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { FormBuilder } from "@/features/tenant-forms/components/form-builder";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { FormTargetType } from "@/features/tenant-forms/types";

function parseTarget(value: string | null): FormTargetType {
  if (value === "checkin" || value === "appointment" || value === "visit_session") {
    return value;
  }
  return "appointment";
}

export function FormsSettingsClient() {
  const { isBootstrapping } = useSession();
  const { hasCapability } = useCapabilities();
  const searchParams = useSearchParams();
  const target = parseTarget(searchParams.get("target"));

  if (isBootstrapping) return null;

  // Issue 3: form configuration is now permission-gated, not
  // role-string-gated. super_admin and dept_admin both have
  // TENANT_FORM_CONFIGURE; receptionist and lower roles do not. The
  // route-level guard still renders PermissionDenied so direct-URL
  // access fails closed even when the sidebar entry is hidden.
  if (!hasCapability(CAPABILITIES.TENANT_FORM_CONFIGURE)) {
    return (
      <PermissionDenied message="Only your tenant's super admin or a department admin can configure appointment and check-in forms." />
    );
  }

  // The builder is reached from different surfaces depending on the target:
  // the appointments page links here for `appointment`, while check-in /
  // visit-session configs come from settings. Send the user back where they
  // came from instead of always to settings.
  const back =
    target === "appointment"
      ? { href: "/app/appointments", label: "Back to appointments" }
      : { href: "/app/settings", label: "Back to settings" };

  return (
    <FormBuilder
      defaultTarget={target}
      backHref={back.href}
      backLabel={back.label}
    />
  );
}
