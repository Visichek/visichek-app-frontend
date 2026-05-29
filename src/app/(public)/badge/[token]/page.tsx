"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePublicBadge } from "@/features/public-registration/hooks";
import {
  PrintBadge,
  printBadgeDims,
  type PrintBadgeData,
  type PrintBadgeFormat,
} from "@/features/visitors/components/print-badge";
import { printVisitorBadge } from "@/features/visitors/lib/badge-export";
import type { VisitStatus } from "@/types/enums";

const FORMAT_OPTIONS: {
  value: PrintBadgeFormat;
  label: string;
  help: string;
}[] = [
  {
    value: "A6",
    label: "A6 · 105 × 148mm",
    help: "Standard lanyard badge size — recommended for most printers.",
  },
  {
    value: "A7",
    label: "A7 · 74 × 105mm",
    help: "Compact size for clip-on holders and thermal label printers.",
  },
];

const STATUS_LABELS: Record<VisitStatus, string> = {
  registered: "Registered",
  pending_verification: "Pending",
  checked_in: "Checked in",
  checked_out: "Checked out",
  denied: "Denied",
  cancelled: "Cancelled",
};

export default function PublicBadgePage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(
    Array.isArray(params.token) ? params.token[0] : params.token ?? "",
  );

  const { data: pass, isLoading, isError, error } = usePublicBadge(token);

  const [format, setFormat] = useState<PrintBadgeFormat>("A6");
  const [isPrinting, setIsPrinting] = useState(false);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  const badgeData = useMemo<PrintBadgeData | null>(() => {
    if (!pass) return null;
    return {
      tenantName: pass.tenant.companyName,
      tenantLogoUrl: pass.tenant.brandingEnabled
        ? pass.tenant.logoUrl
        : undefined,
      visitorName: pass.visitorName,
      company: pass.company,
      purpose: pass.purpose,
      hostName: pass.hostName,
      departmentName: pass.departmentName,
      statusLabel: STATUS_LABELS[pass.status] ?? "Visitor",
      qrToken: pass.token,
      issuedAt: pass.issuedAt,
      expiresAt: pass.expiresAt,
    };
  }, [pass]);

  async function handlePrint() {
    if (!badgeRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printVisitorBadge(badgeRef.current, format);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open the print dialog.",
      );
    } finally {
      setIsPrinting(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading badge…</p>
      </div>
    );
  }

  // ── Error / not found ───────────────────────────────────────────────
  if (isError || !badgeData) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-display font-semibold">
            Badge not found
          </h1>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "This badge link is invalid or has expired. Please ask reception for a new one."}
          </p>
        </div>
      </div>
    );
  }

  const dims = printBadgeDims(format);

  // ── Badge ready ─────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-8 md:py-12">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-2xl font-display font-semibold">Visitor Badge</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Print your badge below, then keep it with you until you check out.
        </p>
      </div>

      {/* Size toggle */}
      <div
        className="grid w-full grid-cols-2 gap-2"
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
                  className={`min-h-[44px] rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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

      {/* Preview */}
      <div
        aria-label="Badge preview"
        className="flex w-full justify-center rounded-lg border bg-muted/30 p-3 sm:p-4"
      >
        <BadgePreviewFrame dims={dims}>
          <PrintBadge ref={badgeRef} data={badgeData} format={format} />
        </BadgePreviewFrame>
      </div>

      {/* Actions */}
      <div className="flex w-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handlePrint}
              disabled={isPrinting}
              className="min-h-[44px] w-full"
            >
              {isPrinting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Print badge
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Open the print dialog and send the badge to the printer at exact{" "}
            {format} size
          </TooltipContent>
        </Tooltip>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        The QR code on this badge is what reception scans to check you out. Keep
        the printed copy until you leave.
      </p>
    </div>
  );
}

interface PreviewFrameProps {
  dims: { width: number; height: number };
  children: ReactNode;
}

/**
 * Scales the print-sized badge down to fit the on-screen card while leaving
 * the underlying mm geometry untouched, so the print/PDF capture stays crisp.
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
    const observer = new ResizeObserver(() => {
      const available = el.clientWidth - 8;
      setScale(Math.min(1, Math.min(360, available) / pxWidth));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pxWidth]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", display: "flex", justifyContent: "center" }}
    >
      <div style={{ width: pxWidth * scale, height: pxHeight * scale }}>
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
