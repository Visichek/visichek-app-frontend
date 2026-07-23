"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useUpdateOverrides,
} from "@/features/subscriptions/hooks/use-subscriptions";
import { useClonePlan } from "@/features/plans/hooks/use-plans";
import type { Subscription, TenantCapLimit } from "@/types/billing";

interface PlanEntitlementsPanelProps {
  subscription: Subscription;
  tenantCompanyName: string;
}

type CapField = keyof TenantCapLimit;

const CAP_FIELDS: { field: CapField; label: string }[] = [
  { field: "maxBranches", label: "Max branches" },
  { field: "maxSystemUsers", label: "Max seats (system users)" },
  { field: "maxDepartments", label: "Max departments" },
  { field: "maxVisitorsPerMonth", label: "Max visitors / month" },
  { field: "maxAppointmentsPerMonth", label: "Max appointments / month" },
  { field: "visitorsPerBranchPerMonth", label: "Visitors per branch / month" },
];

function toSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "org"
  );
}

/**
 * "Plan & entitlements" panel on the admin organization detail page.
 * Two capabilities per parent plan §Task 14:
 *
 * 1. A per-organization subscription-override editor over the existing
 *    `PUT /v1/subscriptions/{id}/overrides` endpoint — lets an admin grant
 *    this one organization a wider cap than its plan allows without
 *    creating a whole bespoke plan.
 * 2. "Create bespoke plan from current" — clones the organization's active
 *    plan (`POST /v1/plans/{id}/clone`, already forces `isPublic=false`)
 *    and routes to the enterprise builder edit page to compose it further.
 */
export function PlanEntitlementsPanel({
  subscription,
  tenantCompanyName,
}: PlanEntitlementsPanelProps) {
  const router = useRouter();
  const updateOverrides = useUpdateOverrides(subscription.id);
  const cloneMutation = useClonePlan();

  const [overrides, setOverrides] = useState<Record<CapField, string>>({
    maxBranches: "",
    maxSystemUsers: "",
    maxDepartments: "",
    maxVisitorsPerMonth: "",
    maxAppointmentsPerMonth: "",
    visitorsPerBranchPerMonth: "",
  });

  const handleSaveOverrides = async () => {
    const tenantCapOverrides: Record<string, number | null> = {};
    for (const { field } of CAP_FIELDS) {
      const raw = overrides[field];
      if (raw === "") continue;
      const n = Number(raw);
      tenantCapOverrides[field] = Number.isFinite(n) ? n : null;
    }
    if (Object.keys(tenantCapOverrides).length === 0) {
      toast.error("Set at least one override value before saving");
      return;
    }
    try {
      await updateOverrides.mutateAsync({ tenantCapOverrides });
      toast.success("Organization overrides saved");
      setOverrides({
        maxBranches: "",
        maxSystemUsers: "",
        maxDepartments: "",
        maxVisitorsPerMonth: "",
        maxAppointmentsPerMonth: "",
        visitorsPerBranchPerMonth: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save overrides",
      );
    }
  };

  const handleCloneToBespoke = async () => {
    const newName = `enterprise-${toSlug(tenantCompanyName)}-${Date.now().toString(36)}`;
    try {
      const cloned = await cloneMutation.mutateAsync({
        sourcePlanId: subscription.planId,
        newName,
        newDisplayName: `${tenantCompanyName} (Enterprise)`,
      });
      toast.success("Bespoke plan created from the current plan");
      router.push(`/admin/plans/${cloned.id}/edit`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clone the plan",
      );
    }
  };

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">Plan &amp; entitlements</p>
        <p className="text-xs text-muted-foreground">
          Grant this organization a per-subscription override, or branch its
          current plan into a bespoke Enterprise plan you can compose further
          in the plan builder.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CAP_FIELDS.map(({ field, label }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={`override-${field}`}>{label}</Label>
            <Input
              id={`override-${field}`}
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="No override"
              value={overrides[field]}
              onChange={(e) =>
                setOverrides((prev) => ({ ...prev, [field]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={handleSaveOverrides}
              disabled={updateOverrides.isPending}
              className="min-h-[44px]"
            >
              {updateOverrides.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Save overrides
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Apply these cap overrides to this organization&apos;s subscription
            only — the underlying plan is unchanged for every other
            organization.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloneToBespoke}
              disabled={cloneMutation.isPending}
              className="min-h-[44px]"
            >
              {cloneMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Create bespoke plan from current
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Clone this organization&apos;s current plan into a new private
            plan, then open the enterprise builder to customize it.
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
