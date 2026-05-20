"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/recipes/page-header";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { ApiError } from "@/types/api";
import { PATHS } from "@/lib/routing/paths";
import {
  useTenantConfirmation,
  useConfirmTenantInfo,
  usePendingOnboardingFields,
} from "@/features/onboarding/hooks";
import type { TenantConfirmationRequest } from "@/types/onboarding";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  companyName: string;
  dpoContactEmail: string;
  privacyPolicyUrl: string;
  countryOfHosting: string;
}

const EMPTY_FORM: FormState = {
  companyName: "",
  dpoContactEmail: "",
  privacyPolicyUrl: "",
  countryOfHosting: "",
};

export function ConfirmTenantClient() {
  const { hasCapability } = useCapabilities();
  const { navigate } = useNavigationLoading();
  // Tenant identity is a tenant-wide write gated to TENANT_CONFIG_EDIT,
  // which only super_admin holds today — the same gate the onboarding
  // completion screen uses.
  const isSuperAdmin = hasCapability(CAPABILITIES.TENANT_CONFIG_EDIT);

  const {
    data: confirmation,
    isLoading,
    isError,
    error,
    refetch,
  } = useTenantConfirmation(isSuperAdmin);

  // Ordering: a partial-accept tenant still owes admin-flagged fields. Those
  // must be completed before the identity review, per the onboarding spec.
  const { data: pending } = usePendingOnboardingFields(isSuperAdmin);
  const hasPendingFields = !!pending && pending.pendingFieldKeys.length > 0;

  const confirm = useConfirmTenantInfo();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prefill once the review payload arrives.
  useEffect(() => {
    if (!confirmation) return;
    setForm({
      companyName: confirmation.companyName ?? "",
      dpoContactEmail: confirmation.dpoContactEmail ?? "",
      privacyPolicyUrl: confirmation.privacyPolicyUrl ?? "",
      countryOfHosting: confirmation.countryOfHosting ?? "",
    });
  }, [confirmation]);

  const originalSubmission = useMemo(() => {
    if (!confirmation?.onboardingFields) return [];
    const order =
      confirmation.onboardingFieldOrder ??
      Object.keys(confirmation.onboardingFields);
    const labels = confirmation.onboardingFieldLabels ?? {};
    const fields = confirmation.onboardingFields;
    return order
      .filter((key) => key in fields)
      .map((key) => ({
        key,
        label: labels[key] ?? key,
        value: formatValue(fields[key]),
      }));
  }, [confirmation]);

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Confirm company details"
          description="Review the details we have on file for your organization."
        />
        <EmptyState
          title="Only the super admin can confirm company details"
          description="Ask the person who first signed your organization up for VisiChek to review this."
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

  if (isError || !confirmation) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="Couldn't load your company details"
          message={message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Already confirmed (e.g. re-visited the URL) — nothing to gate on.
  if (confirmation.onboardingInfoConfirmed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Confirm company details"
          description="Review the details we have on file for your organization."
        />
        <EmptyState
          icon={<BadgeCheck className="h-6 w-6 text-success" />}
          title="Your company details are confirmed"
          description="Thanks — there's nothing else to do here."
          actionLabel="Go to dashboard"
          onAction={() => navigate(PATHS.APP_DASHBOARD)}
        />
      </div>
    );
  }

  // Pending onboarding fields come first.
  if (hasPendingFields) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Confirm company details"
          description="Before reviewing your company identity, finish the onboarding details a platform admin flagged when your account was provisioned."
        />
        <EmptyState
          icon={<Info className="h-6 w-6 text-info" />}
          title="Finish your outstanding onboarding details first"
          description="A few required fields are still missing. Complete them, then come back to confirm your company identity."
          actionLabel="Complete onboarding details"
          onAction={() => navigate(PATHS.APP_ONBOARDING_COMPLETE)}
        />
      </div>
    );
  }

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<FormState> = {};
    const name = form.companyName.trim();
    if (name.length < 1 || name.length > 200) {
      next.companyName = "Company name must be 1–200 characters.";
    }
    const email = form.dpoContactEmail.trim();
    if (email && !EMAIL_RE.test(email)) {
      next.dpoContactEmail = "Enter a valid email address.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  // Only send fields the user actually changed — the endpoint keeps the
  // current value for anything omitted, and an empty body is a valid
  // "acknowledge as-is".
  function buildPayload(): TenantConfirmationRequest {
    if (!confirmation) return {};
    const payload: TenantConfirmationRequest = {};
    const trimmed = {
      companyName: form.companyName.trim(),
      dpoContactEmail: form.dpoContactEmail.trim(),
      privacyPolicyUrl: form.privacyPolicyUrl.trim(),
      countryOfHosting: form.countryOfHosting.trim(),
    };
    if (trimmed.companyName !== (confirmation.companyName ?? "")) {
      payload.companyName = trimmed.companyName;
    }
    if (trimmed.dpoContactEmail !== (confirmation.dpoContactEmail ?? "")) {
      payload.dpoContactEmail = trimmed.dpoContactEmail;
    }
    if (trimmed.privacyPolicyUrl !== (confirmation.privacyPolicyUrl ?? "")) {
      payload.privacyPolicyUrl = trimmed.privacyPolicyUrl;
    }
    if (trimmed.countryOfHosting !== (confirmation.countryOfHosting ?? "")) {
      payload.countryOfHosting = trimmed.countryOfHosting;
    }
    return payload;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    try {
      await confirm.mutateAsync(buildPayload());
      toast.success("Company details confirmed.");
      navigate(PATHS.APP_DASHBOARD);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setSubmitError(
          err.message ||
            "Some details didn't pass validation. Check the fields and try again.",
        );
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "Couldn't save your company details. Please try again.",
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Confirm company details"
        description="Review the company information we carried over from onboarding. Correct anything that's out of date, then confirm to continue."
      />

      {submitError && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Company identity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              id="confirm-companyName"
              label="Company name"
              required
              value={form.companyName}
              onChange={(v) => setField("companyName", v)}
              error={fieldErrors.companyName}
              maxLength={200}
            />
            <Field
              id="confirm-dpoContactEmail"
              label="DPO contact email"
              type="email"
              inputMode="email"
              value={form.dpoContactEmail}
              onChange={(v) => setField("dpoContactEmail", v)}
              error={fieldErrors.dpoContactEmail}
              placeholder="dpo@yourcompany.com"
            />
            <Field
              id="confirm-privacyPolicyUrl"
              label="Privacy policy URL"
              type="url"
              inputMode="url"
              value={form.privacyPolicyUrl}
              onChange={(v) => setField("privacyPolicyUrl", v)}
              error={fieldErrors.privacyPolicyUrl}
              placeholder="https://yourcompany.com/privacy"
            />
            <Field
              id="confirm-countryOfHosting"
              label="Country of hosting"
              value={form.countryOfHosting}
              onChange={(v) => setField("countryOfHosting", v)}
              placeholder="e.g. NG"
            />

            <div className="flex justify-end pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <LoadingButton
                      type="submit"
                      isLoading={confirm.isPending}
                      loadingText="Saving…"
                      className="min-h-[44px] w-full md:w-auto"
                    >
                      Confirm details
                    </LoadingButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Save these company details and continue to your dashboard
                </TooltipContent>
              </Tooltip>
            </div>
          </form>
        </CardContent>
      </Card>

      {originalSubmission.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              What you told us at sign-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {originalSubmission.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <dt className="w-48 shrink-0 text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="break-words">{row.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  inputMode,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  inputMode?: "email" | "url" | "text" | "numeric";
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="text-base md:text-sm"
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
