"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { useSession } from "@/hooks/use-session";
import type {
  Limitations,
  LockedEntities,
  PlanFeatureKey,
} from "@/types/billing";

const limitationsKey = ["me", "limitations"] as const;
/** Exported so other features (e.g. addon mutations) can invalidate this cache directly. */
export const LIMITATIONS_QUERY_KEY = limitationsKey;

const EMPTY_LOCKED: LockedEntities = { branches: [], departments: [] };

/**
 * Fetch `GET /v1/me/limitations`. The payload is small (≈1–3 KB) and
 * idempotent — cache it for a minute, refetch on plan-change events
 * (see `invalidateLimitations` below).
 *
 * Disabled for anonymous users and platform admins (no tenant scope).
 */
export function useLimitations() {
  const { isAuthenticated, isSystemUser } = useSession();
  return useQuery<Limitations>({
    queryKey: limitationsKey,
    queryFn: () => apiGet<Limitations>("/me/limitations"),
    enabled: isAuthenticated && isSystemUser,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/** Invalidate the limitations cache after a subscription change. */
export function useInvalidateLimitations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: limitationsKey });
}

/**
 * A declarative description of what gates a piece of UI behind the plan.
 * Any one matching dimension denies the gate (logical OR). This is the
 * single shape every plan-gated surface (sidebar nav, dashboard quick
 * actions, page-level redirects, in-page controls) builds and hands to
 * `gateDenied`, so the "what counts as denied" logic lives in exactly one
 * place. Adding a new gate dimension means editing `gateDenied` only.
 */
export interface PlanGate {
  /** Stable feature key, matched against `deniedFeatures`. */
  feature?: PlanFeatureKey | string;
  /**
   * API prefix, matched against `deniedEndpoints[].pattern` (startsWith).
   * Use for surfaces with no stable feature key (incidents, audit, dpo).
   */
  apiPrefix?: string;
  /**
   * Entity-cap gate. Denied when the cap is a concrete number `<= max`.
   * `null`/`undefined` cap = unlimited = NOT denied. Use for limits
   * expressed as a number (e.g. Free = 1 system user / 1 department)
   * rather than a feature flag.
   */
  cap?: { field: keyof Limitations["caps"]; max: number };
}

export interface CapabilitiesView {
  /** Resolved limitations payload, or null while loading or for non-tenant users. */
  limitations: Limitations | null;
  /** True when the feature is allowed for the current plan. */
  can: (key: PlanFeatureKey | string) => boolean;
  /** True when the feature is explicitly denied. (Inverse of `can`.) */
  denied: (key: PlanFeatureKey | string) => boolean;
  /**
   * Evaluate a declarative {@link PlanGate} (feature, API prefix, and/or
   * entity cap) in one call. Returns true when the current plan denies it.
   * Does NOT factor in load state — each caller combines this with its own
   * loading policy (e.g. nav hides while loading; quick actions stay
   * clickable while loading). The single source of truth for gate logic.
   */
  gateDenied: (gate: PlanGate) => boolean;
  /** Lookup helpers for greying out branch / department rows. */
  isBranchLocked: (branchId: string) => boolean;
  isDepartmentLocked: (departmentId: string) => boolean;
  /**
   * True when an endpoint prefix appears in `deniedEndpoints`. Used to
   * lock nav rows whose target API surface is plan-gated but does not
   * have a stable `deniedFeatures` key (e.g. `/v1/incidents`,
   * `/v1/audit-logs`, `/v1/compliance/*`). Matches a denial whose
   * `pattern` starts with the supplied prefix.
   */
  isEndpointDenied: (apiPrefix: string) => boolean;
  /** Convenience: cap-and-usage helpers. `null` cap = unlimited. */
  capFor: (
    field: keyof Limitations["caps"],
  ) => number | null | undefined;
  /** True when on the Free fallback plan post-cancel/dunning. */
  isFreeFallback: boolean;
  /**
   * True when the tenant's current plan is Free, however they got there
   * (signup, downgrade, or dunning fallback). Used to gate UI that's
   * always-hidden on Free regardless of `deniedFeatures` (e.g. settings
   * sections the backend doesn't yet ship a feature key for). Matches
   * `plan.tier === "free"` or, for legacy payloads that only set `name`,
   * a case-insensitive `name === "free"`.
   */
  isFreePlan: boolean;
  /** True when the limitations payload hasn't loaded yet. */
  isLoading: boolean;
}

/**
 * Top-level hook for plan-driven UI gating. Hides nav, disables action
 * buttons, marks locked entities. Always treat `isLoading` as
 * "feature available" so we don't flash hidden nav items.
 */
export function useCapability(): CapabilitiesView {
  const { data, isLoading } = useLimitations();

  const view = useMemo<CapabilitiesView>(() => {
    const limitations = data ?? null;
    const deniedSet = new Set<string>(limitations?.deniedFeatures ?? []);
    const branchLocked = new Set<string>(
      limitations?.lockedEntities?.branches ?? [],
    );
    const deptLocked = new Set<string>(
      limitations?.lockedEntities?.departments ?? [],
    );

    const deniedEndpointPatterns: string[] =
      limitations?.deniedEndpoints?.map((e) => e.pattern) ?? [];

    const planTier = limitations?.plan?.tier?.toLowerCase() ?? null;
    const planName = limitations?.plan?.name?.toLowerCase() ?? null;
    const isFreePlan = planTier === "free" || planName === "free";

    return {
      limitations,
      can: (key) => !deniedSet.has(key),
      denied: (key) => deniedSet.has(key),
      isBranchLocked: (id) => branchLocked.has(id),
      isDepartmentLocked: (id) => deptLocked.has(id),
      isEndpointDenied: (apiPrefix) =>
        deniedEndpointPatterns.some((p) => p.startsWith(apiPrefix)),
      gateDenied: (gate) => {
        if (gate.feature && deniedSet.has(gate.feature)) return true;
        if (
          gate.apiPrefix &&
          deniedEndpointPatterns.some((p) => p.startsWith(gate.apiPrefix!))
        ) {
          return true;
        }
        if (gate.cap) {
          const c = limitations?.caps?.[gate.cap.field];
          if (c !== null && c !== undefined && c <= gate.cap.max) return true;
        }
        return false;
      },
      capFor: (field) => limitations?.caps?.[field],
      isFreeFallback: limitations?.plan?.isFreeFallback === true,
      isFreePlan,
      isLoading,
    };
  }, [data, isLoading]);

  // `lockedEntities` defaults: avoid undefined access in callers when
  // the payload arrives without the key (older backend deploys).
  return useMemo(
    () => ({
      ...view,
      limitations: view.limitations
        ? {
            ...view.limitations,
            lockedEntities:
              view.limitations.lockedEntities ?? EMPTY_LOCKED,
          }
        : null,
    }),
    [view],
  );
}
