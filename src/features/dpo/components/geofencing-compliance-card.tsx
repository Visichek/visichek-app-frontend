"use client";

/**
 * DPO-facing summary of the tenant's geofencing configuration.
 *
 * Purpose: geofencing turns every authenticated request into a location
 * beacon and records visitor coordinates on every public submit. That
 * changes the set of personal data the tenant processes, so the DPO
 * needs to know:
 *   - whether it's on
 *   - what's being collected and for how long
 *   - whether the privacy notice needs to be amended to cover it
 *
 * The card is visible to anyone with `PRIVACY_NOTICE_VIEW` — typically
 * the tenant DPO and super_admin. It only issues the privacy-notice
 * reminder banner when the feature is actually enabled.
 */

import Link from "next/link";
import { MapPin, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useTenantSettings } from "@/features/settings/hooks";
import { useSession } from "@/hooks/use-session";
import { useNavigationLoading } from "@/lib/routing/navigation-context";

export function GeofencingComplianceCard() {
  const { tenantId } = useSession();
  const { data, isLoading } = useTenantSettings(tenantId ?? "");
  const { loadingHref, handleNavClick } = useNavigationLoading();

  if (!tenantId || isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Geofencing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Loading compliance status…
          </p>
        </CardContent>
      </Card>
    );
  }

  const enabled = data.geofencingEnabled ?? false;
  const hasReferencePoint =
    data.geofencingReferenceLat != null && data.geofencingReferenceLng != null;
  const radius = data.geofencingRadiusMeters ?? 50;

  const settingsHref = "/app/settings#advanced";
  const settingsLoading = loadingHref === settingsHref;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Geofencing
          </CardTitle>
          <Badge variant={enabled ? "success" : "secondary"}>
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {enabled ? (
          <>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="flex items-start gap-2">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Mode: {hasReferencePoint ? "fixed reference point" : "approver-proximity"}
                  {" · "}radius {radius}m
                </span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin
                  className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Staff locations retained in memory only, TTL 10 minutes. No
                  MongoDB collection and no history table.
                </span>
              </p>
            </div>

            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs flex items-start gap-2">
              <AlertTriangle
                className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Privacy notice action required</p>
                <p className="text-muted-foreground">
                  Update your tenant privacy notice to cover approximate
                  staff-location collection (purpose: verify visitor check-ins
                  happen on-site; retention: up to 10 minutes) before relying
                  on this for enforcement.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Geofencing is off. No visitor or staff coordinates are collected
            for this tenant.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="min-h-[36px]"
              >
                <Link
                  href={settingsHref}
                  onClick={() => handleNavClick(settingsHref)}
                >
                  {settingsLoading ? (
                    <Loader2
                      className="mr-2 h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  Open geofencing settings
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Go to the Advanced settings tab to change the radius, reference
              point, or disable geofencing
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
