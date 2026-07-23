"use client";

import { useState } from "react";
import { Eye, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePreviewPlanLimitations } from "@/features/plans/hooks/use-plans";
import type { UpdatePlanRequest } from "@/features/plans/hooks/use-plans";
import type { Limitations } from "@/types/billing";

interface EnterprisePreviewPanelProps {
  planId: string;
  /** The draft `PlanUpdate` this review step is about to save. */
  draft: UpdatePlanRequest;
}

function CapRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value == null ? "Unlimited" : value}</span>
    </div>
  );
}

/**
 * Enterprise composer review step: calls `POST /plans/{id}/preview-limitations`
 * with the in-progress draft edit and renders the resulting deniedFeatures +
 * caps summary, so an admin can see exactly what a bespoke plan will deny
 * before saving it. No persistence — every click re-derives from the
 * currently stored plan plus the draft on top.
 */
export function EnterprisePreviewPanel({
  planId,
  draft,
}: EnterprisePreviewPanelProps) {
  const previewMutation = usePreviewPlanLimitations(planId);
  const [result, setResult] = useState<Limitations | null>(null);

  const handlePreview = async () => {
    try {
      const data = await previewMutation.mutateAsync(draft);
      setResult(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to compute the plan preview",
      );
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Enterprise builder preview</p>
          <p className="text-xs text-muted-foreground">
            Computes the exact caps and denied features this draft would
            produce for an organization on this plan, without saving anything.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="min-h-[44px] shrink-0"
            >
              {previewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Preview limitations
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Compute the caps and denied features this draft edit would apply,
            before saving it to the plan.
          </TooltipContent>
        </Tooltip>
      </div>

      {result && (
        <div className="space-y-4 border-t border-border pt-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Caps
            </p>
            <CapRow label="Max branches" value={result.caps.maxBranches} />
            <CapRow label="Max departments" value={result.caps.maxDepartments} />
            <CapRow label="Max system users (seats)" value={result.caps.maxSystemUsers} />
            <CapRow
              label="Max visitors / month"
              value={result.caps.maxVisitorsPerMonth}
            />
            <CapRow
              label="Max appointments / month"
              value={result.caps.maxAppointmentsPerMonth}
            />
            <CapRow
              label="Visitors per branch / month"
              value={result.caps.visitorsPerBranchPerMonth}
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Denied features
            </p>
            {result.deniedFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None — every registry feature is enabled on this draft.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.deniedFeatures.map((key) => (
                  <Badge key={key} variant="destructive" className="gap-1">
                    <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                    {key}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
