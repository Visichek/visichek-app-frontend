"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Download,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useMintRegistrationQr } from "@/features/visitors/hooks";
import { useDepartments } from "@/features/departments/hooks/use-departments";

// If the backend returns an actual image (data URL, SVG, or base64 PNG),
// use it directly. Otherwise treat qr_data as a raw token/URL and render
// a QR client-side.
function toImageSrc(qrData: string): string | null {
  if (!qrData) return null;
  if (qrData.startsWith("data:")) return qrData;
  const trimmed = qrData.trim();
  if (trimmed.startsWith("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(qrData)}`;
  }
  // Heuristic: base64 PNGs are long and contain only base64 chars.
  const isLikelyBase64Png =
    trimmed.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
  if (isLikelyBase64Png) return `data:image/png;base64,${qrData}`;
  return null;
}

export default function RegistrationQrPage() {
  const [departmentId, setDepartmentId] = useState<string>("");
  const mintMutation = useMintRegistrationQr();
  const departmentsQuery = useDepartments();

  const qr = mintMutation.data;
  const imgSrc = useMemo(() => (qr ? toImageSrc(qr.qrData) : null), [qr]);
  const qrValue = qr?.registrationUrl || qr?.qrData || "";
  const qrSvgRef = useRef<SVGSVGElement | null>(null);

  async function handleMint() {
    try {
      await mintMutation.mutateAsync({
        departmentId: departmentId || undefined,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate QR"
      );
    }
  }

  function copyUrl() {
    if (!qr?.registrationUrl) return;
    navigator.clipboard
      .writeText(qr.registrationUrl)
      .then(() => toast.success("Registration URL copied"))
      .catch(() => toast.error("Couldn't copy to clipboard"));
  }

  function downloadQr() {
    if (imgSrc) {
      const a = document.createElement("a");
      a.href = imgSrc;
      a.download = "visicheck-registration-qr.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const svg = qrSvgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const href = `data:image/svg+xml;utf8,${encodeURIComponent(xml)}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = "visicheck-registration-qr.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function printQr() {
    window.print();
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            Registration QR Code
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Generate a QR code for visitors to scan at the front desk. They
            scan, fill their own details, and check in faster.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 print:grid-cols-1">
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Scope</CardTitle>
            <CardDescription>
              Optionally bind this QR to a department. Visitors who scan it
              will have that department pre-selected and locked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department (optional)</Label>
              <Select
                value={departmentId}
                onValueChange={(v) =>
                  setDepartmentId(v === "__any__" ? "" : v)
                }
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Any department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any department</SelectItem>
                  {departmentsQuery.data
                    ?.filter((d) => !!d?.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <LoadingButton
                  type="button"
                  onClick={handleMint}
                  isLoading={mintMutation.isPending}
                  loadingText="Generating..."
                  className="w-full"
                >
                  {qr ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate QR
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Generate QR
                    </>
                  )}
                </LoadingButton>
              </TooltipTrigger>
              <TooltipContent side="top">
                Mint a signed registration token and render it as a QR the
                visitor can scan
              </TooltipContent>
            </Tooltip>

            {qr && (
              <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
                <p>
                  Token is valid for 30 days. Regenerate at any time to rotate.
                </p>
                {qr.departmentId && (
                  <p>
                    Scoped to a specific department — visitors can&apos;t
                    change it.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="print:text-center">
            <CardTitle>Scan to register</CardTitle>
            <CardDescription>
              Point your camera at the QR, or visit the link below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-full aspect-square max-w-xs rounded-md border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
              {mintMutation.isPending ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : imgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc}
                  alt="Registration QR code"
                  className="w-full h-full object-contain p-4 bg-white"
                />
              ) : qrValue ? (
                <div className="w-full h-full bg-white p-4 flex items-center justify-center">
                  <QRCodeSVG
                    ref={qrSvgRef}
                    value={qrValue}
                    size={256}
                    level="M"
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="text-center p-6 text-sm text-muted-foreground">
                  <QrCode className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Generate a QR to display it here</p>
                </div>
              )}
            </div>

            {qr?.registrationUrl && (
              <div className="w-full space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Registration URL
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono">
                    {qr.registrationUrl}
                  </code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyUrl}
                        aria-label="Copy registration URL"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Copy the registration URL to share or embed elsewhere
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {qr && (
              <div className="flex w-full gap-2 print:hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={downloadQr}
                      disabled={!imgSrc && !qrValue}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Save the QR image to print or share with visitors
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={printQr}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Open the print dialog to put this QR on the front desk
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
