"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useSession } from "@/hooks/use-session";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { ApiError } from "@/types/api";
import { PATHS } from "@/lib/routing/paths";
import {
  useTenantConfirmation,
  useTenantDpa,
  useConfirmTenantInfo,
  usePendingOnboardingFields,
} from "@/features/onboarding/hooks";
import type { TenantConfirmationRequest, TenantDpa } from "@/types/onboarding";
import { LegalContentRenderer } from "@/features/legal-documents/components/legal-content-renderer";
import { formatDate } from "@/lib/utils/format-date";

interface FormState {
  companyName: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
}

const EMPTY_FORM: FormState = {
  companyName: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressPostalCode: "",
  addressCountry: "",
};

const ADDRESS_LIMITS: Record<keyof Omit<FormState, "companyName">, number> = {
  addressStreet: 200,
  addressCity: 100,
  addressState: 100,
  addressPostalCode: 20,
  addressCountry: 100,
};

export function ConfirmTenantClient() {
  const { hasCapability } = useCapabilities();
  const { navigate } = useNavigationLoading();
  // The DPO contact email is the email of whoever is completing onboarding —
  // the (main) super admin filling this form. We send it on confirm rather
  // than asking for it; it's not an editable field.
  const { systemUserProfile } = useSession();
  const currentUserEmail = systemUserProfile?.email ?? "";
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

  // The per-tenant DPA. A 404 means the template isn't configured on this
  // environment yet — we treat that as "not available" and fall back to the
  // external link rather than blocking onboarding.
  const {
    data: dpa,
    isLoading: dpaLoading,
    error: dpaQueryError,
  } = useTenantDpa(isSuperAdmin);
  const dpaUnavailable =
    dpaQueryError instanceof ApiError && dpaQueryError.status === 404;

  const confirm = useConfirmTenantInfo();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The Data Processing Agreement must be accepted before the tenant can
  // finish onboarding. We capture it here on the first-login confirm step.
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [dpaError, setDpaError] = useState<string | null>(null);

  // If the DPA is already frozen as accepted, reflect that in the checkbox so
  // the gate doesn't ask the super admin to re-accept what they already agreed.
  useEffect(() => {
    if (dpa?.accepted) setDpaAccepted(true);
  }, [dpa?.accepted]);

  // Prefill once the review payload arrives. Tenants saved before the
  // address split only have the joined organizationAddress — surface it in
  // the street field so nothing they entered disappears.
  useEffect(() => {
    if (!confirmation) return;
    const hasStructured =
      confirmation.addressStreet ||
      confirmation.addressCity ||
      confirmation.addressState ||
      confirmation.addressPostalCode ||
      confirmation.addressCountry;
    setForm({
      companyName: confirmation.companyName ?? "",
      addressStreet:
        confirmation.addressStreet ??
        (hasStructured ? "" : (confirmation.organizationAddress ?? "")),
      addressCity: confirmation.addressCity ?? "",
      addressState: confirmation.addressState ?? "",
      addressPostalCode: confirmation.addressPostalCode ?? "",
      addressCountry: confirmation.addressCountry ?? "",
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
    // The organization address feeds the DPA's Controller party block, so
    // the core parts are required to finish onboarding (postal code stays
    // optional — not every region uses one).
    if (!form.addressStreet.trim()) {
      next.addressStreet = "Street address is required.";
    }
    if (!form.addressCity.trim()) {
      next.addressCity = "City is required.";
    }
    if (!form.addressState.trim()) {
      next.addressState = "State or region is required.";
    }
    if (!form.addressCountry.trim()) {
      next.addressCountry = "Country is required.";
    }
    for (const [key, max] of Object.entries(ADDRESS_LIMITS) as [
      keyof typeof ADDRESS_LIMITS,
      number,
    ][]) {
      if (form[key].trim().length > max && !next[key]) {
        next[key] = `Must be ${max} characters or fewer.`;
      }
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
    const trimmedName = form.companyName.trim();
    if (trimmedName !== (confirmation.companyName ?? "")) {
      payload.companyName = trimmedName;
    }
    // Send only changed address parts — the backend merges them with what's
    // on file and recomposes the joined organizationAddress for the DPA.
    const addressFields = [
      ["addressStreet", form.addressStreet, confirmation.addressStreet],
      ["addressCity", form.addressCity, confirmation.addressCity],
      ["addressState", form.addressState, confirmation.addressState],
      [
        "addressPostalCode",
        form.addressPostalCode,
        confirmation.addressPostalCode,
      ],
      ["addressCountry", form.addressCountry, confirmation.addressCountry],
    ] as const;
    for (const [key, value, current] of addressFields) {
      const trimmed = value.trim();
      if (trimmed !== (current ?? "")) {
        payload[key] = trimmed;
      }
    }
    // The DPO contact email is always the email of the super admin completing
    // onboarding — not a field they fill in. Send it when it differs from
    // what's on file.
    const email = currentUserEmail.trim();
    if (email && email !== (confirmation.dpoContactEmail ?? "")) {
      payload.dpoContactEmail = email;
    }
    // Privacy policy URL is prepared per-tenant by the backend — never send it
    // so we don't overwrite the prepared value.
    // Country of hosting is not collected here — submit it blank.
    if ((confirmation.countryOfHosting ?? "") !== "") {
      payload.countryOfHosting = "";
    }
    // DPA acceptance is the gate for finishing onboarding — always record it
    // (the submit is blocked until the box is checked) with the moment of
    // acceptance as a Unix timestamp.
    payload.dpaAccepted = true;
    payload.dpaAcceptedAt = Math.floor(Date.now() / 1000);
    return payload;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const fieldsValid = validate();
    if (!dpaAccepted) {
      setDpaError("You must accept the Data Processing Agreement to continue.");
    }
    if (!fieldsValid || !dpaAccepted) return;

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Company identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              id="confirm-companyName"
              label="Company name"
              required
              disabled
              value={form.companyName}
              onChange={(v) => setField("companyName", v)}
              error={fieldErrors.companyName}
              maxLength={200}
              hint="This is the company name on file. Contact support if it needs to change."
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">Organization address</p>
              <p className="text-xs text-muted-foreground">
                Used to fill the Organization party block in your Data
                Processing Agreement.
              </p>
            </div>
            <Field
              id="confirm-addressStreet"
              label="Street address"
              required
              value={form.addressStreet}
              onChange={(v) => setField("addressStreet", v)}
              error={fieldErrors.addressStreet}
              maxLength={ADDRESS_LIMITS.addressStreet}
              placeholder="e.g. 1 Main Street"
            />
            <div className="flex flex-col gap-5 md:flex-row">
              <div className="flex-1">
                <Field
                  id="confirm-addressCity"
                  label="City"
                  required
                  value={form.addressCity}
                  onChange={(v) => setField("addressCity", v)}
                  error={fieldErrors.addressCity}
                  maxLength={ADDRESS_LIMITS.addressCity}
                  placeholder="e.g. Ikeja"
                />
              </div>
              <div className="flex-1">
                <Field
                  id="confirm-addressState"
                  label="State / region"
                  required
                  value={form.addressState}
                  onChange={(v) => setField("addressState", v)}
                  error={fieldErrors.addressState}
                  maxLength={ADDRESS_LIMITS.addressState}
                  placeholder="e.g. Lagos"
                />
              </div>
            </div>
            <div className="flex flex-col gap-5 md:flex-row">
              <div className="flex-1">
                <Field
                  id="confirm-addressPostalCode"
                  label="Postal code"
                  value={form.addressPostalCode}
                  onChange={(v) => setField("addressPostalCode", v)}
                  error={fieldErrors.addressPostalCode}
                  maxLength={ADDRESS_LIMITS.addressPostalCode}
                  placeholder="e.g. 100001"
                  inputMode="numeric"
                  hint="Optional."
                />
              </div>
              <div className="flex-1">
                <Field
                  id="confirm-addressCountry"
                  label="Country"
                  required
                  value={form.addressCountry}
                  onChange={(v) => setField("addressCountry", v)}
                  error={fieldErrors.addressCountry}
                  maxLength={ADDRESS_LIMITS.addressCountry}
                  placeholder="e.g. Nigeria"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Processing Agreement — preview + acceptance gate. */}
        <DpaCard
          dpa={dpa}
          loading={dpaLoading}
          unavailable={dpaUnavailable}
          accepted={dpaAccepted}
          error={dpaError}
          onAcceptedChange={(checked) => {
            setDpaAccepted(checked);
            if (checked) setDpaError(null);
          }}
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

/**
 * The Data Processing Agreement preview + acceptance gate. Renders the
 * per-tenant DPA body (BlockNote blocks) read-only when available, an
 * "accepted on <date>" state once frozen, and a graceful fallback (external
 * link) when the tenant DPA isn't available yet (`404`) or failed to load.
 */
function DpaCard({
  dpa,
  loading,
  unavailable,
  accepted,
  error,
  onAcceptedChange,
}: {
  dpa: TenantDpa | undefined;
  loading: boolean;
  unavailable: boolean;
  accepted: boolean;
  error: string | null;
  onAcceptedChange: (checked: boolean) => void;
}) {
  const alreadyAccepted = !!dpa?.accepted;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          {dpa?.title ?? "Data Processing Agreement"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading your Data Processing Agreement…
          </div>
        ) : dpa ? (
          <>
            <p className="text-xs text-muted-foreground">
              Version {dpa.version}. The Organization details below are drawn
              from the company information above — saving your edits together
              with acceptance freezes the exact wording you agree to.
            </p>
            <div
              className="max-h-96 overflow-y-auto rounded-md border border-border bg-muted/20 p-4"
              role="region"
              aria-label="Data Processing Agreement text"
              tabIndex={0}
            >
              <LegalContentRenderer blocks={dpa.body} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {unavailable
              ? "Your tailored Data Processing Agreement isn’t available to preview yet."
              : "We couldn’t load your Data Processing Agreement preview right now."}{" "}
            You can still review the{" "}
            <a
              href="https://www.visichek.app/legal/dpa"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              standard agreement
            </a>{" "}
            and accept to continue.
          </p>
        )}

        {alreadyAccepted ? (
          <div className="flex items-start gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm">
            <BadgeCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="font-medium">Data Processing Agreement accepted</p>
              <p className="text-muted-foreground">
                Accepted on {formatDate(dpa?.acceptedAt)}
                {dpa?.version ? ` (version ${dpa.version})` : ""}.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm-dpaAccepted"
                checked={accepted}
                onCheckedChange={(checked) => onAcceptedChange(checked === true)}
                className="mt-0.5 h-5 w-5"
                aria-invalid={!!error}
                aria-describedby={error ? "confirm-dpaAccepted-error" : undefined}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="confirm-dpaAccepted"
                  className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                >
                  <ShieldCheck
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  I have read and accept the Data Processing Agreement
                </Label>
                <p className="text-xs text-muted-foreground">
                  On behalf of your organization, you agree to the Data
                  Processing Agreement{dpa ? " shown above" : ""} governing how
                  visitor personal data is processed under the NDPA.
                </p>
              </div>
            </div>
            {error && (
              <p
                id="confirm-dpaAccepted-error"
                className="mt-2 text-xs text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required,
  disabled,
  type = "text",
  inputMode,
  placeholder,
  maxLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
  inputMode?: "email" | "url" | "text" | "numeric";
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;
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
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className="text-base md:text-sm disabled:cursor-not-allowed disabled:opacity-70"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
