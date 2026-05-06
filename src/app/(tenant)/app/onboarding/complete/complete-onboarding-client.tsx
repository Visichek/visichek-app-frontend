"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/recipes/page-header";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import {
  useCompleteOnboarding,
  usePendingOnboardingFields,
} from "@/features/onboarding/hooks";
import type { OnboardingFieldValue } from "@/types/onboarding";

const DASHBOARD_HREF = "/app/dashboard";

export function CompleteOnboardingClient() {
  const { currentRole } = useSession();
  const { navigate } = useNavigationLoading();
  const isSuperAdmin = currentRole === "super_admin";

  const {
    data: pending,
    isLoading,
    isError,
    error,
    refetch,
  } = usePendingOnboardingFields(isSuperAdmin);
  const complete = useCompleteOnboarding();

  const [values, setValues] = useState<Record<string, string>>({});

  // Hydrate empty strings for every pending field once the query settles.
  useEffect(() => {
    if (!pending?.pendingFieldKeys) return;
    setValues((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const key of pending.pendingFieldKeys) {
        if (!(key in next)) next[key] = "";
      }
      return next;
    });
  }, [pending?.pendingFieldKeys]);

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Complete onboarding"
          description="Finish setup for your VisiChek tenant."
        />
        <EmptyState
          title="Only the super admin can complete onboarding"
          description="Ask the person who first signed your organisation up for VisiChek to finish this step."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  // The endpoint 404s/409s when there's nothing to complete — surface that
  // as a neutral empty state rather than a scary error.
  if (isError) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    const isNothingToComplete =
      /not_found|no.*pending|already|409|404/i.test(message);
    if (isNothingToComplete) {
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <PageHeader
            title="Complete onboarding"
            description="Finish setup for your VisiChek tenant."
          />
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6 text-success" />}
            title="Nothing left to complete"
            description="Your onboarding has already been finalised. You can head straight to the dashboard."
            actionLabel="Go to dashboard"
            onAction={() => navigate(DASHBOARD_HREF)}
          />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="Couldn't load your onboarding tasks"
          message={message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!pending || pending.pendingFieldKeys.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Complete onboarding"
          description="Finish setup for your VisiChek tenant."
        />
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-success" />}
          title="Nothing left to complete"
          description="Your onboarding has already been finalised."
          actionLabel="Go to dashboard"
          onAction={() => navigate(DASHBOARD_HREF)}
        />
      </div>
    );
  }

  const orderedKeys = pending.pendingFieldKeys;

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!pending) return;

    const payload: Record<string, OnboardingFieldValue> = {};
    const missing: string[] = [];
    for (const key of pending.pendingFieldKeys) {
      const raw = (values[key] ?? "").trim();
      if (!raw) {
        missing.push(pending.pendingFieldLabels[key] ?? key);
        continue;
      }
      payload[key] = raw;
    }

    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    toast.promise(
      complete.mutateAsync({ values: payload }),
      {
        loading: "Submitting…",
        success: () => {
          navigate(DASHBOARD_HREF);
          return "Onboarding complete. Welcome to VisiChek.";
        },
        error: (err: Error) =>
          err.message || "Failed to submit onboarding details.",
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Complete onboarding"
        description="A platform admin needs the following details before your tenant is fully set up. These were flagged when your account was provisioned."
        actions={
          <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs">
            {orderedKeys.length} field
            {orderedKeys.length === 1 ? "" : "s"} pending
          </span>
        }
      />

      {pending.reviewNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-info" />
              Note from the platform team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{pending.reviewNotes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            Pending information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {orderedKeys.map((key) => {
              const label = pending.pendingFieldLabels[key] ?? key;
              const value = values[key] ?? "";
              const id = `pending-field-${key}`;
              const useTextarea = value.length > 80 || /address|notes|description/i.test(label);
              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={id}>
                    {label} <span aria-hidden="true">*</span>
                  </Label>
                  {useTextarea ? (
                    <Textarea
                      id={id}
                      value={value}
                      onChange={(e) => handleChange(key, e.target.value)}
                      rows={3}
                      maxLength={4000}
                      required
                    />
                  ) : (
                    <Input
                      id={id}
                      value={value}
                      onChange={(e) => handleChange(key, e.target.value)}
                      maxLength={4000}
                      required
                      className="text-base md:text-sm"
                    />
                  )}
                </div>
              );
            })}

            <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => navigate(DASHBOARD_HREF)}
                    disabled={complete.isPending}
                  >
                    {complete.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Skip for now
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Go to the dashboard — you can return here any time to complete the form
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <LoadingButton
                      type="submit"
                      isLoading={complete.isPending}
                      loadingText="Submitting…"
                      className="min-h-[44px] w-full md:w-auto"
                    >
                      Submit &amp; finish
                    </LoadingButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Send these answers back to the platform team and finalise onboarding
                </TooltipContent>
              </Tooltip>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
