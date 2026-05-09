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
  VisitorBadge,
  visitorBadgeDims,
  type VisitorBadgeData,
  type VisitorBadgeFormat,
} from "./visitor-badge";
import {
  downloadVisitorBadgePdf,
  printVisitorBadge,
} from "../lib/badge-export";

export interface PrintBadgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Badge data without tenant info — branding is merged in from Redux. */
  badge: Omit<VisitorBadgeData, "tenantName" | "logoUrl" | "primaryColor"> & {
    /** Optional override; falls back to Redux tenant branding. */
    tenantName?: string;
  };
}

const FORMAT_OPTIONS: { value: VisitorBadgeFormat; label: string; help: string }[] = [
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
  const [format, setFormat] = useState<VisitorBadgeFormat>("A6");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  // Reset to A6 default each time the modal opens.
  useEffect(() => {
    if (open) setFormat("A6");
  }, [open]);

  const data = useMemo<VisitorBadgeData>(
    () => ({
      ...badge,
      tenantName:
        badge.tenantName || branding?.companyName || "Your Company",
      logoUrl: branding?.badgeLogoUrl || branding?.logoUrl,
      primaryColor:
        branding?.badgePrimaryColor || branding?.primaryColor || "#0f172a",
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

  const dims = visitorBadgeDims(format);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Print visitor badge"
      description={`Preview the badge before printing. Default size is A6 (${FORMAT_OPTIONS[0].label.split(" ")[1]}).`}
    >
      <div className="space-y-4">
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

        <div
          aria-label="Badge preview"
          className="rounded-lg border bg-muted/30 p-3 sm:p-4 flex justify-center"
        >
          <BadgePreviewFrame format={format} dims={dims}>
            <VisitorBadge ref={badgeRef} data={data} format={format} />
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
  format: VisitorBadgeFormat;
  dims: { width: number; height: number };
  children: React.ReactNode;
}

/**
 * Wraps the print-sized badge in a responsive scaled box for on-screen
 * preview. The badge itself stays at its real mm size (so html2canvas
 * captures it crisply); only the visual presentation is scaled.
 */
function BadgePreviewFrame({ format, dims, children }: PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // 1mm ≈ 3.7795 CSS px at 96dpi.
  const pxWidth = dims.width * 3.7795;
  const pxHeight = dims.height * 3.7795;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const available = el.clientWidth;
      const target = format === "A6" ? Math.min(360, available - 8) : Math.min(280, available - 8);
      setScale(Math.min(1, target / pxWidth));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [format, pxWidth]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        display: "flex",
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
  );
}
