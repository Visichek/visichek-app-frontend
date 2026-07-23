"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { useAppSelector } from "@/lib/store/hooks";
import { selectBranding } from "@/lib/store/branding-slice";
import { useCapability } from "@/features/limitations/hooks";
import type { TenantBranding } from "@/types/tenant";
import {
  VisitorBadge,
  BadgeScaleFrame,
  badgePrintDims,
  printVariantForFormat,
  type BadgeBranding,
  type BadgePassData,
  type BadgePrintFormat,
} from "./visitor-badge";
import {
  downloadVisitorBadgePdf,
  printVisitorBadge,
} from "../lib/badge-export";

/**
 * Badge data the caller supplies — org identity/branding is merged in
 * from the Redux branding slice (or the `branding` override prop).
 */
export interface PrintBadgeModalData {
  visitorName: string;
  company?: string;
  purpose?: string;
  hostName?: string;
  departmentName?: string;
  /** Short status label rendered in the badge's corner pill. */
  statusLabel: string;
  /** The badge QR token — encoded in the QR. */
  qrToken: string;
  /** Unix epoch seconds — rendered as the check-in time. */
  issuedAt?: number;
  /** Unix epoch seconds — rendered as the validity window. */
  expiresAt?: number;
  /** Optional override; falls back to Redux tenant branding company name. */
  tenantName?: string;
}

export interface PrintBadgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge: PrintBadgeModalData;
  /**
   * Override the badge branding (e.g. the settings page passes the
   * CURRENT UNSAVED branding edits for a true WYSIWYG test print).
   * Omit to derive branding from the Redux tenant branding slice;
   * pass `null` explicitly to force the neutral VisiChek layout.
   */
  branding?: BadgeBranding | null;
  /** Mark the badge as a sample (settings test print). */
  sample?: boolean;
}

/**
 * Build the badge branding block from the tenant branding record the
 * shell already has in Redux. Mirrors the backend's badge-pass
 * fallbacks: header falls back to the primary brand color, text to
 * white. Returns null when the tenant has no branding at all — the
 * badge then renders the neutral VisiChek layout.
 */
export function badgeBrandingFromTenantBranding(
  branding: TenantBranding | null | undefined,
): BadgeBranding | null {
  if (!branding) return null;
  const headerColor = branding.badgeHeaderColor ?? branding.primaryColor;
  const logoUrl = branding.badgeLogoUrl ?? branding.logoUrl;
  // NOTE: a record with no explicit colors/logo still returns a branding
  // object — the badge component supplies the same header/text fallbacks
  // the backend badge-pass uses, so the reception print matches the
  // visitor's kiosk badge exactly.
  return {
    headerColor: headerColor ?? null,
    textColor: branding.badgeTextColor ?? null,
    logoUrl: logoUrl ?? null,
    logoPosition: branding.logoPosition ?? branding.badgeLogoPosition ?? null,
    companyDisplayName:
      branding.companyDisplayName ?? branding.companyName ?? null,
  };
}

const FORMAT_OPTIONS: { value: BadgePrintFormat; label: string; help: string }[] = [
  {
    value: "A6",
    label: "A6 (105 × 148mm)",
    help: "Standard lanyard badge size — recommended for most printers.",
  },
  {
    value: "A7",
    label: "A7 (74 × 105mm)",
    help: "Compact size for clip-on holders and thermal label printers.",
  },
];

export function PrintBadgeModal({
  open,
  onOpenChange,
  badge,
  branding: brandingOverride,
  sample = false,
}: PrintBadgeModalProps) {
  const tenantBranding = useAppSelector(selectBranding);
  const [format, setFormat] = useState<BadgePrintFormat>("A6");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  // Reset to A6 default each time the modal opens.
  useEffect(() => {
    if (open) setFormat("A6");
  }, [open]);

  // Mirror the backend badge-pass gate: the badge renders branded
  // whenever the plan allows branding — even if the org never customised
  // colors (component fallbacks apply), so the reception print always
  // matches the visitor's kiosk badge. Only branding-denied plans get
  // the neutral layout.
  const { can } = useCapability();
  const badgeBranding = useMemo<BadgeBranding | null>(() => {
    if (brandingOverride !== undefined) return brandingOverride;
    const fromRecord = badgeBrandingFromTenantBranding(tenantBranding);
    if (fromRecord) return fromRecord;
    return can("branding") ? {} : null;
  }, [brandingOverride, tenantBranding, can]);

  const data = useMemo<BadgePassData>(
    () => ({
      visitorName: badge.visitorName,
      orgName:
        badge.tenantName || tenantBranding?.companyName || "Your Company",
      company: badge.company ?? null,
      purpose: badge.purpose ?? null,
      departmentName: badge.departmentName ?? null,
      hostName: badge.hostName ?? null,
      checkInTime: badge.issuedAt ?? null,
      qrValue: badge.qrToken,
      validFrom: badge.issuedAt ?? null,
      validUntil: badge.expiresAt ?? null,
      statusLabel: badge.statusLabel,
    }),
    [badge, tenantBranding],
  );

  async function handlePrint() {
    if (!badgeRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printVisitorBadge(badgeRef.current, format);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open print dialog.";
      toast.error(message);
    } finally {
      setIsPrinting(false);
    }
  }

  async function handleDownload() {
    if (!badgeRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadVisitorBadgePdf(badgeRef.current, format, data.visitorName);
      toast.success("Badge PDF downloaded");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not generate the badge PDF.";
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  }

  const dims = badgePrintDims(format);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Print visitor badge"
      description="Preview the badge before printing. Default size is A6 (105 × 148 mm)."
    >
      {/* Definite height (not max-h) — the preview frame is `flex-1` with an
          absolutely-positioned child, so without a resolved height on this
          column the preview collapses to 0px and the badge never shows. */}
      <div className="flex h-[calc(85vh-7rem)] flex-col gap-4">
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Badge size"
        >
          {FORMAT_OPTIONS.map((option) => {
            const isActive = option.value === format;
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setFormat(option.value)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-muted"
                    }`}
                  >
                    {option.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{option.help}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* overflow-hidden, NOT overflow-y-auto. The preview scales itself to
            fit, so it never needs to scroll — and an auto scrollbar here fed
            straight back into the measurement below: badge grows -> scrollbar
            appears -> container narrows -> badge shrinks -> scrollbar goes ->
            container widens -> badge grows, forever. That loop is what made
            the modal appear to flicker open and closed on every print. */}
        <div
          aria-label="Badge preview"
          className="flex min-h-0 flex-1 justify-center overflow-hidden rounded-lg border bg-muted/30 p-3 sm:p-4"
        >
          <BadgeScaleFrame dims={dims} fit="both">
            <VisitorBadge
              ref={badgeRef}
              data={data}
              branding={badgeBranding}
              variant={printVariantForFormat(format)}
              sample={sample}
            />
          </BadgeScaleFrame>
        </div>

        <p className="text-xs text-muted-foreground">
          The QR code on this badge is what reception scans to check the
          visitor out. Keep the printed copy until checkout.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isDownloading || isPrinting}
                className="min-h-[44px] sm:min-w-[170px]"
              >
                {isDownloading ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Download PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Save the badge as a PDF file you can share or reprint later
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handlePrint}
                disabled={isPrinting || isDownloading}
                className="min-h-[44px] sm:min-w-[140px]"
              >
                {isPrinting ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Print badge
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Open the print dialog and send the badge to the connected
              printer at exact {format} size
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </ResponsiveModal>
  );
}
