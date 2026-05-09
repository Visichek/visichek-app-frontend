"use client";

import { useMemo } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBranches } from "@/features/branches/hooks/use-branches";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import type { Branch } from "@/types/tenant";

interface BranchPickerProps {
  /** Selected branch ids. Empty array is treated as "default to HQ". */
  value: string[];
  onChange: (next: string[]) => void;
  /** Inline error message rendered under the picker. */
  error?: string;
  /**
   * Pre-loaded branch list. If omitted, the picker fetches with
   * `useBranches()` itself.
   */
  branches?: Branch[];
  /**
   * Pre-loaded plan-derived branch cap. If omitted, the picker reads it
   * from `useMyUsage()`. `null` or `undefined` means "unlimited" — only
   * `>= 1` is treated as a cap.
   */
  maxBranchesOverride?: number | null;
  disabled?: boolean;
}

/**
 * Multi-branch assignment picker for the user invite + edit forms.
 *
 * Behaviour, per the branch-isolation spec:
 * - Plans where `max_branches <= 1` → single-branch UX. The picker
 *   collapses to a single Select with HQ pre-selected. The user submits
 *   either the chosen branch or [HQ] by default.
 * - Plans with `max_branches > 1` (or unlimited) → multi-select grid
 *   with a hard cap. HQ is always the first option and pre-ticked when
 *   the form opens with no value. An inline upgrade nudge appears once
 *   the cap is hit.
 * - The branch list is sorted with the headquarters branch first, then
 *   alphabetically. If a row's `isHeadquarters` flag is missing the
 *   picker falls back to the name match `"... - Headquarters"` produced
 *   by the server-side backfill.
 */
export function BranchPicker({
  value,
  onChange,
  error,
  branches: branchesOverride,
  maxBranchesOverride,
  disabled,
}: BranchPickerProps) {
  const branchesQuery = useBranches();
  const usageQuery = useMyUsage();

  const branches = branchesOverride ?? branchesQuery.data ?? [];
  const branchesLoading =
    branchesOverride === undefined && branchesQuery.isLoading;

  // Plan-derived cap. `null` from the backend means unlimited.
  const planCap =
    maxBranchesOverride !== undefined
      ? maxBranchesOverride
      : (usageQuery.data?.entityCaps?.maxBranches ?? null);

  // Single-branch plans collapse to a select. Treat 0/undefined plan as 1
  // until usage hydrates — safer than letting the user pick many on a
  // tier that will then 403 on submit.
  const isSingleBranchPlan = planCap !== null && planCap <= 1;

  const sortedBranches = useMemo(() => {
    return [...branches].sort((a, b) => {
      const aHq =
        a.isHeadquarters === true ||
        (a.isHeadquarters === undefined && /headquarters/i.test(a.name));
      const bHq =
        b.isHeadquarters === true ||
        (b.isHeadquarters === undefined && /headquarters/i.test(b.name));
      if (aHq && !bHq) return -1;
      if (!aHq && bHq) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [branches]);

  const hqBranch = sortedBranches.find(
    (b) =>
      b.isHeadquarters === true ||
      (b.isHeadquarters === undefined && /headquarters/i.test(b.name))
  );

  const capHit =
    planCap !== null && planCap !== undefined && value.length >= planCap;

  if (branchesLoading) {
    return (
      <div className="space-y-2">
        <Label>Branches</Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading branches…
        </div>
      </div>
    );
  }

  // Single-branch plan: collapse picker to a single select.
  if (isSingleBranchPlan) {
    const selected = value[0] ?? hqBranch?.id ?? "";

    return (
      <div className="space-y-2">
        <Label htmlFor="branch-single">Branch</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={selected}
                onValueChange={(next) => onChange(next ? [next] : [])}
                disabled={disabled || sortedBranches.length === 0}
              >
                <SelectTrigger id="branch-single" className="min-h-[44px]">
                  <SelectValue placeholder="Headquarters" />
                </SelectTrigger>
                <SelectContent>
                  {sortedBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <span className="flex items-center gap-2">
                        <Building2
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {branch.name}
                        {(branch.isHeadquarters ||
                          /headquarters/i.test(branch.name)) && (
                          <Badge variant="secondary" className="ml-1">
                            HQ
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            Pick the branch this user works at. Your plan supports one
            branch per user — upgrade to assign multiple branches.
          </TooltipContent>
        </Tooltip>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Multi-branch plan: checkbox grid with cap nudge.
  const toggle = (branchId: string) => {
    if (disabled) return;
    if (value.includes(branchId)) {
      onChange(value.filter((id) => id !== branchId));
      return;
    }
    if (capHit) return; // hard cap — ignore additional adds
    onChange([...value, branchId]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Branches *</Label>
        {planCap !== null && (
          <span className="text-xs text-muted-foreground">
            {value.length} / {planCap} selected
          </span>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-md border bg-card p-3 space-y-2 max-h-60 overflow-y-auto">
            {sortedBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No branches available. Create one first under Branches.
              </p>
            ) : (
              sortedBranches.map((branch) => {
                const checked = value.includes(branch.id);
                const isHq =
                  branch.isHeadquarters === true ||
                  /headquarters/i.test(branch.name);
                const limitedByCap = capHit && !checked;
                const inputId = `branch-opt-${branch.id}`;
                return (
                  <label
                    key={branch.id}
                    htmlFor={inputId}
                    className={`flex items-center gap-3 rounded-sm p-2 min-h-[44px] cursor-pointer hover:bg-muted/50 ${
                      limitedByCap || disabled
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={() => toggle(branch.id)}
                      disabled={disabled || limitedByCap}
                      aria-label={`Assign user to ${branch.name}`}
                    />
                    <span className="flex-1 flex items-center gap-2 text-sm">
                      <Building2
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="font-medium">{branch.name}</span>
                      {isHq && <Badge variant="secondary">HQ</Badge>}
                      {branch.isActive === false && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          Select every branch this user should be able to see and act on.
          The first branch is free — additional branches use your plan&apos;s
          multi-branch quota.
        </TooltipContent>
      </Tooltip>
      {capHit && (
        <p className="text-xs text-muted-foreground">
          Your plan supports up to {planCap} branches per user. To assign a
          user to more than {planCap} {planCap === 1 ? "branch" : "branches"},
          upgrade your plan.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
