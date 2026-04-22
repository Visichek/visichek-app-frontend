"use client";

/**
 * Geofencing configuration block — super_admin only.
 *
 * Lives under the Advanced tab alongside the rest of the tenant-wide
 * policy settings. The block is self-contained so future tenant-settings
 * sections can follow the same pattern without bloating `advanced-tab`.
 *
 * What it does
 * ------------
 *   - Enables or disables the tenant's geofencing check.
 *   - Picks a radius (10m strict → 5000m industrial-estate).
 *   - Chooses between reference-point mode (fixed office coordinate) and
 *     approver-proximity mode (any active approver within radius).
 *   - Lets the super_admin snap the reference point to their own current
 *     browser location — which is almost always what you want when
 *     configuring from the office.
 */

import { useState } from "react";
import { Crosshair, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { SettingsSelect, SettingsToggle } from "@/components/recipes/settings-section";
import { useUpdateTenantSettings } from "@/features/settings/hooks";
import { requestUserLocation } from "@/lib/geolocation/user-location";
import { cn } from "@/lib/utils/cn";
import type { TenantSettings, TenantSettingsUpdate } from "@/types/settings";

// Radius options are cribbed from the product doc's "picking a radius"
// table. Labels describe the site-size the radius is tuned for so the
// admin does not need to guess which bucket their office falls into.
const RADIUS_OPTIONS = [
  { value: "10", label: "10m — strict (outdoor kiosks only)" },
  { value: "20", label: "20m — strict" },
  { value: "50", label: "50m — standard (default)" },
  { value: "100", label: "100m — large office" },
  { value: "250", label: "250m — small campus" },
  { value: "500", label: "500m — large campus" },
  { value: "1000", label: "1km — estate / warehouse" },
  { value: "2500", label: "2.5km — industrial site" },
  { value: "5000", label: "5km — maximum" },
] as const;

interface GeofencingSectionProps {
  settings: TenantSettings;
}

export function GeofencingSection({ settings }: GeofencingSectionProps) {
  const update = useUpdateTenantSettings(settings.tenantId);
  const [latInput, setLatInput] = useState<string>(
    settings.geofencingReferenceLat == null
      ? ""
      : String(settings.geofencingReferenceLat)
  );
  const [lngInput, setLngInput] = useState<string>(
    settings.geofencingReferenceLng == null
      ? ""
      : String(settings.geofencingReferenceLng)
  );
  const [coordError, setCoordError] = useState<string | null>(null);
  const [useMyLocationLoading, setUseMyLocationLoading] = useState(false);
  const [useMyLocationError, setUseMyLocationError] = useState<string | null>(
    null
  );

  const enabled = settings.geofencingEnabled ?? false;
  const hasReferencePoint =
    settings.geofencingReferenceLat != null &&
    settings.geofencingReferenceLng != null;
  const mode: "reference" | "approver" = hasReferencePoint
    ? "reference"
    : "approver";

  function parseLat(value: string): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < -90 || n > 90) return null;
    return n;
  }

  function parseLng(value: string): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < -180 || n > 180) return null;
    return n;
  }

  function commitReferencePoint() {
    setCoordError(null);
    const trimmedLat = latInput.trim();
    const trimmedLng = lngInput.trim();
    if (trimmedLat === "" && trimmedLng === "") {
      // Clearing both fields switches the tenant to approver-proximity mode.
      patch({ geofencingReferenceLat: null, geofencingReferenceLng: null });
      return;
    }
    const lat = parseLat(trimmedLat);
    const lng = parseLng(trimmedLng);
    if (lat == null) {
      setCoordError("Latitude must be a number between -90 and 90.");
      return;
    }
    if (lng == null) {
      setCoordError("Longitude must be a number between -180 and 180.");
      return;
    }
    patch({
      geofencingReferenceLat: lat,
      geofencingReferenceLng: lng,
    });
  }

  function patch(diff: TenantSettingsUpdate) {
    update.mutate(diff);
  }

  async function onUseMyLocation() {
    setUseMyLocationError(null);
    setUseMyLocationLoading(true);
    try {
      const loc = await requestUserLocation();
      if (!loc) {
        setUseMyLocationError(
          "We couldn't read your location. Grant location access in your browser and try again."
        );
        return;
      }
      setLatInput(loc.lat.toFixed(6));
      setLngInput(loc.lng.toFixed(6));
      patch({
        geofencingReferenceLat: loc.lat,
        geofencingReferenceLng: loc.lng,
      });
      setCoordError(null);
    } finally {
      setUseMyLocationLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <SettingsToggle
        id="geofencingEnabled"
        label="Enable geofencing"
        description="Require visitors to be physically on-site before their check-in is accepted"
        checked={enabled}
        onCheckedChange={(v) => patch({ geofencingEnabled: v })}
        isLoading={update.isPending}
      />

      {enabled && (
        <>
          <SettingsSelect
            id="geofencingRadiusMeters"
            label="Geofence radius"
            description="How far a visitor can be from the site (or an active approver) and still check in"
            value={String(settings.geofencingRadiusMeters ?? 50)}
            onValueChange={(v) =>
              patch({ geofencingRadiusMeters: parseInt(v, 10) })
            }
            options={RADIUS_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            isLoading={update.isPending}
            tooltip="Indoor GPS is usually accurate to 20–50m, so very small radii produce false rejections"
          />

          <div className="rounded-lg border p-4 space-y-4 mt-2">
            <div className="flex items-start gap-3">
              <MapPin
                className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium">Reference point</p>
                <p className="text-xs text-muted-foreground">
                  {mode === "reference"
                    ? "Visitors are measured against a fixed office coordinate. Deterministic — recommended for most sites."
                    : "Visitors are measured against any approver who has reported a location in the last 10 minutes. Leaves both fields empty to stay in this mode."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="geofence-lat" className="text-xs">
                  Latitude
                </Label>
                <Input
                  id="geofence-lat"
                  inputMode="decimal"
                  placeholder="e.g. 6.524379"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  onBlur={commitReferencePoint}
                  className={cn(
                    "text-base md:text-sm min-h-[44px]",
                    coordError &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={!!coordError || undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="geofence-lng" className="text-xs">
                  Longitude
                </Label>
                <Input
                  id="geofence-lng"
                  inputMode="decimal"
                  placeholder="e.g. 3.379206"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  onBlur={commitReferencePoint}
                  className={cn(
                    "text-base md:text-sm min-h-[44px]",
                    coordError &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={!!coordError || undefined}
                />
              </div>
            </div>

            {coordError && (
              <p role="alert" className="text-xs text-destructive">
                {coordError}
              </p>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[36px]"
                      onClick={onUseMyLocation}
                      disabled={useMyLocationLoading}
                    >
                      {useMyLocationLoading ? (
                        <Loader2
                          className="mr-2 h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Crosshair
                          className="mr-2 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )}
                      Use my current location
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Ask your browser for your current coordinates and save them
                  as the site reference point — do this from a device at the
                  office
                </TooltipContent>
              </Tooltip>

              {hasReferencePoint && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-[36px] text-destructive hover:text-destructive"
                      onClick={() => {
                        setLatInput("");
                        setLngInput("");
                        setCoordError(null);
                        patch({
                          geofencingReferenceLat: null,
                          geofencingReferenceLng: null,
                        });
                      }}
                    >
                      Clear reference point
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Remove the fixed coordinate and fall back to
                    approver-proximity mode (any on-site approver accepts the
                    visitor)
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {useMyLocationError && (
              <p
                role="alert"
                className="flex items-start gap-2 text-xs text-destructive"
              >
                <AlertTriangle
                  className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>{useMyLocationError}</span>
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Before rolling this out:</strong>{" "}
            ask your DPO to update the tenant privacy notice to cover
            "approximate location is collected while logged in, retained for
            up to 10 minutes, to verify visitor check-ins happen on-site".
          </div>
        </>
      )}
    </div>
  );
}
