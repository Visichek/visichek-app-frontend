"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  LogOut,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/feedback/loading-button";
import { usePublicCheckout } from "@/features/public-registration/hooks";
import { ApiError } from "@/types/api";
import type { PublicCheckoutResponse } from "@/types/public";

// ── Schema ───────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  badge_qr_token: z.string().min(1, "Badge token is required"),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

// ── Helper ───────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${hours}h ${remaining}m`;
}

// ── Page Component ───────────────────────────────────────────────────

export default function PublicCheckoutPage() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const checkoutMutation = usePublicCheckout();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicCheckoutResponse | null>(null);
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      badge_qr_token: tokenFromUrl,
    },
  });

  // ── Auto-submit when token is in URL (one-tap checkout) ───────────
  useEffect(() => {
    if (tokenFromUrl && !result && !submitError) {
      setAutoSubmitting(true);
      setValue("badge_qr_token", tokenFromUrl);
      performCheckout(tokenFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function performCheckout(token: string) {
    setSubmitError(null);
    try {
      const response = await checkoutMutation.mutateAsync({
        badge_qr_token: token,
      });
      setResult(response);
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.code || "";
        if (code.includes("NOT_FOUND") || err.status === 404) {
          setSubmitError(
            "No active visit found for this badge. The session may have already ended."
          );
        } else if (code.includes("EXPIRED") || code.includes("INVALID")) {
          setSubmitError(
            "This badge token is invalid or expired. Please ask reception for help."
          );
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError("Checkout failed. Please try again or ask reception for help.");
      }
    } finally {
      setAutoSubmitting(false);
    }
  }

  function onSubmit(values: CheckoutFormValues) {
    performCheckout(values.badge_qr_token);
  }

  // ── Auto-submit loading ───────────────────────────────────────────
  if (autoSubmitting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Checking you out...
          </p>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2
                className="h-8 w-8 text-success"
                aria-hidden="true"
              />
            </div>
            <CardTitle className="text-xl font-display">
              Checked Out Successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your visit has been recorded. Thank you for visiting.
            </p>

            <div className="space-y-3 rounded-md bg-muted p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">
                  {result.session.status.replace("_", " ")}
                </span>
              </div>
              {result.visit_duration_minutes != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visit Duration</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDuration(result.visit_duration_minutes)}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              You may now leave the premises. Have a great day.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Error state (after auto-submit failed) ────────────────────────
  // ── Form state ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <LogOut className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-display font-semibold">
          Visitor Check-Out
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Scan your badge QR code or enter the token from your visitor badge to
          check out.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Check Out</CardTitle>
          <CardDescription>
            Enter your badge token to end your visit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitError && (
              <div
                className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{submitError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="badge_qr_token">
                Badge Token <span className="text-destructive">*</span>
              </Label>
              <Input
                id="badge_qr_token"
                type="text"
                placeholder="Enter or paste your badge token"
                autoFocus
                className="text-base md:text-sm font-mono"
                {...register("badge_qr_token")}
              />
              {errors.badge_qr_token && (
                <p className="text-sm text-destructive">
                  {errors.badge_qr_token.message}
                </p>
              )}
            </div>

            <LoadingButton
              type="submit"
              isLoading={checkoutMutation.isPending}
              loadingText="Checking out..."
              className="w-full"
            >
              Check Out
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
