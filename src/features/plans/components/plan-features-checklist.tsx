"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import {
  useFeatureCatalog,
  useTogglePlanFeature,
} from "@/features/plans/hooks/use-plans";
import type { Plan, PlanFeatureCatalogEntry } from "@/types/billing";

interface PlanFeaturesChecklistProps {
  plan: Plan;
}

/**
 * Match a catalog entry against the plan's `featureRules`. Mirrors the
 * backend comparison in `plan_feature_service._is_match` — both
 * `endpointPattern` and the full `methods` set must agree.
 */
function findMatchingRule(spec: PlanFeatureCatalogEntry, plan: Plan) {
  const wantedMethods = new Set(spec.methods.map((m) => m.toUpperCase()));
  return plan.featureRules?.find(
    (rule) =>
      rule.endpointPattern === spec.endpointPattern &&
      rule.methods.length === wantedMethods.size &&
      rule.methods.every((m) => wantedMethods.has(m.toUpperCase())),
  );
}

function isFeatureEnabled(spec: PlanFeatureCatalogEntry, plan: Plan): boolean {
  const rule = findMatchingRule(spec, plan);
  return rule ? rule.enabled : spec.defaultEnabled;
}

export function PlanFeaturesChecklist({ plan }: PlanFeaturesChecklistProps) {
  const {
    data: catalog,
    isLoading: catalogLoading,
    isError: catalogError,
    refetch: refetchCatalog,
  } = useFeatureCatalog();
  const toggleMutation = useTogglePlanFeature(plan.id);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  if (catalogError) {
    return (
      <ErrorState
        title="Couldn't load feature catalog"
        message="Refresh to try again."
        onRetry={() => refetchCatalog()}
      />
    );
  }

  if (catalogLoading || !catalog) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 w-full animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No togglable features have been registered yet.
        </p>
      </div>
    );
  }

  const handleToggle = async (
    spec: PlanFeatureCatalogEntry,
    next: boolean,
  ) => {
    setPendingKey(spec.key);
    try {
      await toggleMutation.mutateAsync({
        featureKey: spec.key,
        enabled: next,
      });
      toast.success(`${spec.label} ${next ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${next ? "enable" : "disable"} ${spec.label}`,
      );
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Each toggle saves immediately and applies to all tenants on this plan
        within a few seconds.
      </p>
      {catalog.map((spec) => {
        const enabled = isFeatureEnabled(spec, plan);
        const isThisPending = pendingKey === spec.key;
        const isAnyPending = pendingKey !== null;
        const switchId = `feature-toggle-${spec.key}`;
        const showConfigBanner =
          enabled && spec.requiresExternalConfig && !!spec.externalConfigHint;

        return (
          <div
            key={spec.key}
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <Label
                  htmlFor={switchId}
                  className="cursor-pointer text-sm font-medium"
                >
                  {spec.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {spec.description}
                </p>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-2">
                    {isThisPending && (
                      <Loader2
                        className="h-4 w-4 animate-spin text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <Switch
                      id={switchId}
                      checked={enabled}
                      disabled={isAnyPending}
                      onCheckedChange={(c) => handleToggle(spec, c)}
                      aria-label={`${enabled ? "Disable" : "Enable"} ${spec.label}`}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {enabled
                    ? `Disable ${spec.label} for all tenants on this plan`
                    : `Enable ${spec.label} for all tenants on this plan`}
                </TooltipContent>
              </Tooltip>
            </div>

            {showConfigBanner && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p className="font-medium">Action required</p>
                  <p>{spec.externalConfigHint}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
