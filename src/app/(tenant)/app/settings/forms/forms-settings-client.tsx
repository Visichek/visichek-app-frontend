"use client";

import { useSearchParams } from "next/navigation";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { FormBuilder } from "@/features/tenant-forms/components/form-builder";
import { useSession } from "@/hooks/use-session";
import type { FormTargetType } from "@/features/tenant-forms/types";

function parseTarget(value: string | null): FormTargetType {
  if (value === "checkin" || value === "appointment" || value === "visit_session") {
    return value;
  }
  return "appointment";
}

export function FormsSettingsClient() {
  const { currentRole, isBootstrapping } = useSession();
  const searchParams = useSearchParams();
  const target = parseTarget(searchParams.get("target"));

  if (isBootstrapping) return null;

  if (currentRole !== "super_admin") {
    return (
      <PermissionDenied message="Only your tenant's super admin can configure appointment and check-in forms." />
    );
  }

  return (
    <FormBuilder
      defaultTarget={target}
      backHref="/app/settings"
      backLabel="Back to settings"
    />
  );
}
