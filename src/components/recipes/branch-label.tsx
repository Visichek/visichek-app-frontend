import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Minimal branch shape embedded on Phase 4 list/detail responses
 * (`branchSummary`). Kept structural so callers can pass the inline
 * summary off any resource without importing a shared nominal type.
 */
export interface BranchSummaryLike {
  id: string;
  name: string;
  isActive?: boolean;
}

interface BranchLabelProps {
  branch?: BranchSummaryLike | null;
  /** Fallback rendered when no branch resolves (e.g. a legacy row). */
  fallback?: string;
  className?: string;
}

/**
 * Renders a tenant branch as a compact, non-interactive label with a
 * location glyph. Used for the "Branch" column/label that unscoped roles
 * (super_admin / auditor / dpo) see on visitor-operations lists — see
 * `useShowBranch`. Non-interactive by design, so it carries no tooltip.
 */
export function BranchLabel({
  branch,
  fallback = "—",
  className,
}: BranchLabelProps) {
  if (!branch?.name) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        {fallback}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm text-muted-foreground",
        className,
      )}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{branch.name}</span>
    </span>
  );
}
