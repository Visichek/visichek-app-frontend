"use client";

import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { refreshSession } from "@/lib/auth/session";
import { useAppSelector } from "@/lib/store/hooks";
import { selectSessionType } from "@/lib/store/session-slice";

/**
 * Debug-only button that manually triggers the unified refresh flow.
 * Renders next to the notification bell in the topbar.
 *
 * Auth tokens are httpOnly cookies — JS cannot read them, so this only
 * logs Redux session state and reports refresh success/failure. Inspect
 * the Set-Cookie headers in the network tab to verify cookie rotation.
 */
export function DebugRefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sessionType = useAppSelector(selectSessionType);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    // eslint-disable-next-line no-console
    console.groupCollapsed("[debug-refresh] starting refresh");
    // eslint-disable-next-line no-console
    console.log("session type before:", sessionType);

    const toastId = toast.loading("Refreshing session…");

    try {
      await refreshSession();

      // eslint-disable-next-line no-console
      console.log("refresh succeeded — check network tab for new Set-Cookie");
      // eslint-disable-next-line no-console
      console.groupEnd();

      toast.success("Refresh succeeded", {
        id: toastId,
        description: "Cookies rotated — see network tab for Set-Cookie headers",
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[debug-refresh] failed:", err);
      // eslint-disable-next-line no-console
      console.groupEnd();

      const message =
        err instanceof Error ? err.message : "Unknown refresh error";
      toast.error("Refresh failed", {
        id: toastId,
        description: message,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px]"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Debug: trigger token refresh"
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <RefreshCw className="h-5 w-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Debug: manually trigger the /auth/refresh flow and log session state to the console
      </TooltipContent>
    </Tooltip>
  );
}
