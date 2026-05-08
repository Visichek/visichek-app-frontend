"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CameraOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SCANNER_ELEMENT_ID = "badge-scanner-region";

export interface BadgeScannerProps {
  /** Called when a token is captured from camera or manual paste. */
  onResult: (token: string) => void;
  /** Disable the manual paste fallback input. */
  hideManualEntry?: boolean;
}

type ScannerStatus = "idle" | "starting" | "running" | "error" | "no-camera";

export function BadgeScanner({
  onResult,
  hideManualEntry = false,
}: BadgeScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");

  const scannerRef = useRef<unknown>(null);
  const mountedRef = useRef(true);
  const consumedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function start() {
    if (status === "starting" || status === "running") return;
    setErrorMessage(null);
    setStatus("starting");
    consumedRef.current = false;

    try {
      const mod = await import("html5-qrcode");
      if (!mountedRef.current) return;

      const Html5Qrcode = mod.Html5Qrcode;
      const cameras = await Html5Qrcode.getCameras().catch(() => [] as Array<{ id: string }>);
      if (!mountedRef.current) return;

      if (!cameras || cameras.length === 0) {
        setStatus("no-camera");
        setErrorMessage(
          "No camera was detected on this device. Use the manual entry below.",
        );
        return;
      }

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        verbose: false,
        formatsToSupport: [
          mod.Html5QrcodeSupportedFormats.QR_CODE,
          mod.Html5QrcodeSupportedFormats.CODE_128,
          mod.Html5QrcodeSupportedFormats.CODE_39,
          mod.Html5QrcodeSupportedFormats.EAN_13,
          mod.Html5QrcodeSupportedFormats.UPC_A,
          mod.Html5QrcodeSupportedFormats.PDF_417,
          mod.Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
      });
      scannerRef.current = scanner;

      const preferred =
        cameras.find((c) => /back|rear|environment/i.test((c as { label?: string }).label ?? ""))
          ?.id ?? cameras[0].id;

      await scanner.start(
        preferred,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (consumedRef.current) return;
          consumedRef.current = true;
          onResult(decodedText.trim());
          void stop();
        },
        () => {
          // Per-frame decode misses fire here continuously; ignore.
        },
      );

      if (!mountedRef.current) {
        await stop();
        return;
      }

      setStatus("running");
    } catch (e) {
      if (!mountedRef.current) return;
      setStatus("error");
      setErrorMessage(
        e instanceof Error
          ? e.message
          : "Couldn't start the camera. Check permissions and try again.",
      );
    }
  }

  async function stop() {
    const scanner = scannerRef.current as
      | { stop: () => Promise<void>; clear: () => void; getState?: () => number }
      | null;
    if (!scanner) {
      if (mountedRef.current) setStatus("idle");
      return;
    }
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // ignore — scanner may already be stopped
    } finally {
      scannerRef.current = null;
      if (mountedRef.current) setStatus("idle");
    }
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current as
        | { stop: () => Promise<void>; clear: () => void }
        | null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            /* ignore */
          });
        scannerRef.current = null;
      }
    };
  }, []);

  function handleManualSubmit() {
    const trimmed = manualToken.trim();
    if (!trimmed) return;
    onResult(trimmed);
    setManualToken("");
  }

  const isRunning = status === "running";
  const isStarting = status === "starting";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div
          id={SCANNER_ELEMENT_ID}
          className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted/30"
          aria-live="polite"
        >
          {!isRunning && !isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="rounded-full bg-muted p-3">
                {status === "no-camera" ? (
                  <CameraOff
                    className="h-6 w-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <Camera
                    className="h-6 w-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                {status === "error" || status === "no-camera"
                  ? errorMessage
                  : "Tap start to open your camera and scan the visitor's badge QR or barcode."}
              </p>
            </div>
          )}
          {isStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Loader2
                className="h-6 w-6 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isRunning ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void stop()}
                  className="min-h-[44px]"
                >
                  <CameraOff
                    className="mr-2 h-4 w-4"
                    aria-hidden="true"
                  />
                  Stop camera
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Turn off the camera and release it for other apps
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => void start()}
                  disabled={isStarting}
                  className="min-h-[44px]"
                >
                  {isStarting ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {status === "error" || status === "no-camera"
                    ? "Try again"
                    : "Start camera"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Open the device camera to scan a badge QR or barcode
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {status === "error" && errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle
              className="h-4 w-4 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <p>{errorMessage}</p>
          </div>
        )}
      </div>

      {!hideManualEntry && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="manual-token">Or paste the badge token</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="manual-token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste from a hardware scanner or copy"
              autoComplete="off"
              className="flex-1 text-base md:text-sm min-h-[44px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleManualSubmit();
                }
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={!manualToken.trim()}
                  className="min-h-[44px]"
                >
                  Use token
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Submit the pasted token as if it were scanned from the badge
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            Hardware scanners type the token like a keyboard — focus this box
            and scan, or paste the token by hand.
          </p>
        </div>
      )}
    </div>
  );
}
