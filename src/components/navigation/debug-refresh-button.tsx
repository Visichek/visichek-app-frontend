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
import { getAccessToken, getRefreshToken, getSessionType } from "@/lib/auth/tokens";

/**
 * Debug-only button that manually triggers the unified token refresh flow.
 * Renders next to the notification bell in the topbar.
 *
 * Logs token state before and after the call to the browser console so the
 * full request/response cycle can be inspected alongside the network tab.
 */
export function DebugRefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    const before = {
      sessionType: getSessionType(),
      accessToken: getAccessToken(),
      refreshToken: getRefreshToken(),
    };
    // eslint-disable-next-line no-console
    console.groupCollapsed("[debug-refresh] starting refresh");
    // eslint-disable-next-line no-console
    console.log("before:", before);

    const toastId = toast.loading("Refreshing session…");

    try {
      const newAccessToken = await refreshSession();

      const after = {
        sessionType: getSessionType(),
        accessToken: getAccessToken(),
        refreshToken: getRefreshToken(),
      };
      // eslint-disable-next-line no-console
      console.log("after:", after);
      // eslint-disable-next-line no-console
      console.log("returned access token:", newAccessToken);
      // eslint-disable-next-line no-console
      console.groupEnd();

      toast.success("Refresh succeeded", {
        id: toastId,
        description: newAccessToken
          ? `New access token: ${newAccessToken.slice(0, 12)}…`
          : "Refresh returned an empty access token",
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
        Debug: manually trigger the /auth/refresh flow and log tokens to the console
      </TooltipContent>
    </Tooltip>
  );
}
