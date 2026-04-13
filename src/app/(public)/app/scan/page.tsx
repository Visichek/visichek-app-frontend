"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Keyboard,
  Loader2,
  QrCode,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// UUID v4-ish matcher (backend uses uuid strings for tenant_id)
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type DetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

function extractTenantFromPayload(
  payload: string
): { tenantId: string; token?: string } | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  // 1. Try as URL — look for /register/<tenantId> segment + optional ?token=
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    const regIdx = segments.indexOf("register");
    const candidate = regIdx >= 0 ? segments[regIdx + 1] : undefined;
    if (candidate && UUID_RE.test(candidate)) {
      const token = url.searchParams.get("token") ?? undefined;
      return { tenantId: candidate.match(UUID_RE)![0], token };
    }
  } catch {
    /* not a URL, fall through */
  }

  // 2. Bare UUID anywhere in payload
  const uuidMatch = trimmed.match(UUID_RE);
  if (uuidMatch) return { tenantId: uuidMatch[0] };

  return null;
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<DetectorLike | null>(null);

  const [status, setStatus] = useState<
    "idle" | "starting" | "scanning" | "unsupported" | "denied" | "redirecting"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleMatch = (payload: string) => {
    const parsed = extractTenantFromPayload(payload);
    if (!parsed) {
      setErrorMsg(
        "QR code didn't contain a recognizable tenant ID. Try again or enter it manually."
      );
      return;
    }
    setStatus("redirecting");
    stopCamera();
    const qs = parsed.token
      ? `?token=${encodeURIComponent(parsed.token)}`
      : "";
    router.replace(`/register/${parsed.tenantId}${qs}`);
  };

  const startCamera = async () => {
    setErrorMsg(null);

    const BarcodeDetectorCtor = (
      globalThis as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => DetectorLike;
      }
    ).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      setStatus("unsupported");
      return;
    }

    setStatus("starting");
    try {
      detectorRef.current = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setStatus("scanning");

      const tick = async () => {
        if (!videoRef.current || !detectorRef.current) return;
        if (videoRef.current.readyState >= 2) {
          try {
            const results = await detectorRef.current.detect(videoRef.current);
            if (results.length > 0 && results[0].rawValue) {
              handleMatch(results[0].rawValue);
              return;
            }
          } catch {
            /* ignore per-frame errors */
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      stopCamera();
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setStatus("denied");
      } else {
        setStatus("idle");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Couldn't start camera. Try again or enter the tenant ID manually."
        );
      }
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = extractTenantFromPayload(manualId);
    if (!parsed) {
      setErrorMsg("Enter a valid tenant ID or registration URL.");
      return;
    }
    setErrorMsg(null);
    setStatus("redirecting");
    stopCamera();
    const qs = parsed.token
      ? `?token=${encodeURIComponent(parsed.token)}`
      : "";
    router.replace(`/register/${parsed.tenantId}${qs}`);
  };

  return (
    <main className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/app/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              aria-label="Back to login"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the login page for staff sign-in
          </TooltipContent>
        </Tooltip>
        <h1 className="flex items-center gap-2 text-sm font-medium">
          <QrCode className="h-4 w-4" />
          Scan to register
        </h1>
        <span className="w-14" aria-hidden />
      </header>

      <section className="flex-1 flex flex-col items-center justify-start gap-6 px-4 py-6 max-w-md mx-auto w-full">
        <div className="w-full aspect-square rounded-lg overflow-hidden border border-border bg-muted/40 relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          {status !== "scanning" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {status === "starting" ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Starting camera…
                  </p>
                </>
              ) : status === "redirecting" ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Opening registration…
                  </p>
                </>
              ) : status === "unsupported" ? (
                <>
                  <CameraOff className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    This browser can&apos;t scan QR codes. Use the manual
                    option below, or open this page in Chrome or your
                    phone&apos;s browser.
                  </p>
                </>
              ) : status === "denied" ? (
                <>
                  <CameraOff className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Camera permission denied. Allow camera access in your
                    browser settings, or use manual entry.
                  </p>
                </>
              ) : (
                <>
                  <ScanLine className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Point your camera at the tenant QR code to start
                    registration.
                  </p>
                </>
              )}
            </div>
          )}
          {status === "scanning" && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-8 border-2 border-primary/70 rounded-md"
            />
          )}
        </div>

        {status === "idle" || status === "unsupported" || status === "denied" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={startCamera}
                disabled={status === "unsupported"}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                {status === "denied" ? "Retry camera" : "Start camera"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Turn on the camera and begin scanning for a tenant QR code
            </TooltipContent>
          </Tooltip>
        ) : status === "scanning" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  stopCamera();
                  setStatus("idle");
                }}
                className="w-full"
              >
                <CameraOff className="h-4 w-4 mr-2" />
                Stop camera
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Turn off the camera and stop scanning
            </TooltipContent>
          </Tooltip>
        ) : null}

        {errorMsg && (
          <p className="text-sm text-destructive text-center" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="w-full border-t border-border pt-4">
          <form onSubmit={onManualSubmit} className="space-y-2">
            <Label
              htmlFor="manualId"
              className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide"
            >
              <Keyboard className="h-3.5 w-3.5" />
              Can&apos;t scan? Enter tenant ID or registration URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="manualId"
                placeholder="e.g. 8f3b…-…-… or https://…/register/…"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="flex-1"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="submit" variant="outline">
                    Go
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Open the registration page for the tenant ID you entered
                </TooltipContent>
              </Tooltip>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
