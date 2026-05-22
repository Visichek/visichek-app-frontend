"use client";

import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpgradePrompt } from "@/features/limitations/components";
import { API_BASE_URL } from "@/lib/api/client";
import {
  toInsightsQueryParams,
  type InsightsParams,
} from "../hooks/use-insights";
import { ANALYTICS_FEATURES } from "../lib/analytics-gates";

/**
 * Downloads the current Insights view as CSV
 * (`GET /v1/dashboard/insights/export?format=csv`). Uses `fetch` with cookie
 * credentials so the StreamingResponse blob bypasses the JSON envelope
 * interceptors. Gated by `analytics.export`: Free renders a locked button that
 * opens the upgrade modal (the server also returns 403 SUBSCRIPTION_REQUIRED).
 */
export function ExportButton({
  params,
  canExport,
}: {
  params: InsightsParams;
  canExport: boolean;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { promptUpgrade } = useUpgradePrompt();

  async function download() {
    setIsDownloading(true);
    try {
      const qs = new URLSearchParams({
        ...toInsightsQueryParams(params),
        format: "csv",
      }).toString();
      const res = await fetch(`${API_BASE_URL}/dashboard/insights/export?${qs}`, {
        credentials: "include",
      });

      if (res.status === 403) {
        promptUpgrade({ featureKey: ANALYTICS_FEATURES.export, title: "Analytics export" });
        return;
      }
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insights-${params.roleView}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export ready", { description: "Your CSV download has started." });
    } catch (err) {
      toast.error("Couldn't export", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsDownloading(false);
    }
  }

  if (!canExport) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              promptUpgrade({ featureKey: ANALYTICS_FEATURES.export, title: "Analytics export" })
            }
            aria-label="Export — available on paid plans"
          >
            <Lock className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Export
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Download this view as a CSV. Available on paid plans — click to see what an upgrade
          unlocks.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={download}
          disabled={isDownloading}
          aria-label="Export this view as CSV"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          Export
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Download the current role, range, and filters as a CSV file.
      </TooltipContent>
    </Tooltip>
  );
}
