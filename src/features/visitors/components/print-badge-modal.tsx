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
import {
  PrintBadge,
  printBadgeDims,
  type PrintBadgeData,
  type PrintBadgeFormat,
} from "./print-badge";
import {
  downloadVisitorBadgePdf,
  printVisitorBadge,
} from "../lib/badge-export";

/** Badge data the caller supplies — tenant info is merged in from Redux. */
export type PrintBadgeModalData = Omit<PrintBadgeData, "tenantName" | "tenantLogoUrl"> & {
  /** Optional override; falls back to Redux tenant branding company name. */
  tenantName?: string;
};

export interface PrintBadgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge: PrintBadgeModalData;
}

const FORMAT_OPTIONS: { value: PrintBadgeFormat; label: string; help: string }[] = [
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
}: PrintBadgeModalProps) {
  const branding = useAppSelector(selectBranding);
  const [format, setFormat] = useState<PrintBadgeFormat>("A6");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  // Reset to A6 default each time the modal opens.
  useEffect(() => {
    if (open) setFormat("A6");
  }, [open]);

  const data = useMemo<PrintBadgeData>(
    () => ({
      ...badge,
      tenantName:
        badge.tenantName || branding?.companyName || "Your Company",
      tenantLogoUrl: branding?.badgeLogoUrl || branding?.logoUrl || undefined,
    }),
    [badge, branding],
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

  const dims = printBadgeDims(format);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Print visitor badge"
      description={`Preview the badge before printing. Default size is A6 (${FORMAT_OPTIONS[0].label.split(" ")[1]}).`}
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
          <BadgePreviewFrame dims={dims}>
            <PrintBadge ref={badgeRef} data={data} format={format} />
          </BadgePreviewFrame>
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

interface PreviewFrameProps {
  dims: { width: number; height: number };
  children: React.ReactNode;
}

/**
 * Scales the print-sized badge down to fit the on-screen preview while
 * leaving the underlying mm geometry untouched, so the print and PDF
 * capture stays crisp. Scales by BOTH available width and height so the
 * badge never overflows the dialog and the action buttons stay in view.
 */
function BadgePreviewFrame({ dims, children }: PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // 1mm ≈ 3.7795 CSS px at 96dpi.
  const pxWidth = dims.width * 3.7795;
  const pxHeight = dims.height * 3.7795;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const availableWidth = Math.max(0, el.clientWidth - 8);
      const availableHeight = Math.max(0, el.clientHeight - 8);
      const widthScale = availableWidth > 0 ? availableWidth / pxWidth : 1;
      const heightScale = availableHeight > 0 ? availableHeight / pxHeight : 1;
      const next = Math.min(1, widthScale, heightScale);

      // Ignore sub-pixel noise. Without this, the dialog's open animation
      // (a 200ms zoom) drives a fresh measurement on every frame and the
      // preview visibly churns while it settles.
      setScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    };

    // Defer to the next frame: measuring synchronously inside the observer
    // callback and immediately re-rendering is what triggers the browser's
    // "ResizeObserver loop completed with undelivered notifications" error.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    });
    observer.observe(el);
    compute();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pxWidth, pxHeight]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        flex: 1,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Absolutely positioned so the scaled badge is OUT OF FLOW and can
          never influence the size of the element we measure. The scale is
          derived from the container, so if the container could in turn be
          sized by the badge we would be right back in a measurement loop. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: pxWidth * scale,
            height: pxHeight * scale,
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: pxWidth,
              height: pxHeight,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
