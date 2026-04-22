"use client";

/**
 * Kiosk check-in flow.
 *
 * The Identity step fires `POST /v1/public/tenants/{tenant_id}/visitor-status`
 * on Continue. The response determines which of two sub-flows runs:
 *
 *   full  — new visitor, or a profile-only match (visitor_id missing).
 *           Steps: Identity → Verify (optional ID upload) → Details
 *           (bio + tenant_specific) → Review. Submits multipart to
 *           `/public/tenants/{id}/submit`.
 *
 *   compact — recognised returning visitor (visitor_id present).
 *           Steps: Identity → (skip Verify) → Details (tenant_specific
 *           only, plus purpose) → Review. Submits JSON to
 *           `/public/tenants/{id}/submit-by-visitor-id`; the backend
 *           reuses the stored visitor record for name / email / phone /
 *           company / verification.
 *
 * The step indicator always shows the same four labels — in compact mode
 * the Verify step is auto-marked complete so the progress feels coherent.
 *
 * URL is keyed by tenantId (existing convention). The active check-in
 * config is resolved from the tenantId on mount.
 */

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  UserCheck,
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Loader2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { parsePhone } from "@/lib/constants/countries";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { StepIndicator, type StepDef } from "@/components/recipes/step-indicator";
import {
  useActiveCheckinConfigForTenant,
  useVisitorStatus,
  useSubmitCheckin,
  useSubmitCheckinByVisitorId,
  RequiredFieldsForm,
  IdUploadStep,
  describeCheckinError,
} from "@/features/checkins";
import { usePublicTenantBranding } from "@/hooks/use-public-tenant-branding";
import { requestUserLocation } from "@/lib/geolocation/user-location";
import type {
  IdType,
  PublicVisitorStatusOut,
  PurposeInfo,
  RequiredField,
} from "@/types/checkin";

// ── Types ────────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  { id: 1, label: "Identity", icon: UserCheck },
  { id: 2, label: "Verify", icon: ShieldCheck },
  { id: 3, label: "Details", icon: ClipboardList },
  { id: 4, label: "Review", icon: CheckCircle2 },
];

/**
 * Recognition-driven mode for the flow.
 *
 * - `"full"`: the tenant has not seen this email/phone, or has only a
 *   profile record without a linked visitor_id. The visitor fills in name,
 *   company, optional ID upload, purpose, and tenant-specific fields. The
 *   final submit goes to `/public/tenants/{id}/submit` (multipart).
 * - `"compact"`: the backend returned `found=true` with a `visitor_id`. We
 *   skip the bio-data collection and ID upload entirely; the visitor only
 *   needs to fill in the purpose (and any required tenant-specific
 *   fields). The final submit goes to `/public/tenants/{id}/submit-by-
 *   visitor-id` (plain JSON).
 */
type FlowMode = "full" | "compact";

/** Flow-level state that survives step navigation. */
interface KioskState {
  email: string;
  phone: string;
  useId: boolean; // true if the visitor chose to upload an ID
  idFile: File | null;
  idType: IdType | null;
  fieldValues: Record<string, unknown>;
  purposeText: string;
  purposeDetails: string;
}

// Browser-grade email check — good enough for UX gating; the backend is the
// authority on acceptance.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// Require a parseable dial code and at least a few digits of national number.
// E.164 allows up to 15 digits total; we accept 6..15 to reject obviously
// empty entries while staying permissive about national formatting.
function isValidInternationalPhone(value: string): boolean {
  const parsed = parsePhone(value);
  if (!parsed) return false;
  const digits = parsed.national.replace(/[^\d]/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

const INITIAL_STATE: KioskState = {
  email: "",
  phone: "",
  useId: false,
  idFile: null,
  idType: null,
  fieldValues: {},
  purposeText: "",
  purposeDetails: "",
};

// ── Page ─────────────────────────────────────────────────────────────

export default function KioskCheckinPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const configQ = useActiveCheckinConfigForTenant(tenantId);

  // Recognition probe + both submit paths. We call `visitor-status` on
  // Identity → Continue and use its `visitorId` to pick the submit route.
  // The tenant-scoped multipart submit is the default path when
  // `visitor-status` returns `found=false` or `visitorId=null`; the JSON
  // `submit-by-visitor-id` route is used for recognised visitors so we
  // don't re-send their email / phone / bio_data.
  const visitorStatusMutation = useVisitorStatus({ tenantId });
  const submitFullMutation = useSubmitCheckin({ configId: undefined, tenantId });
  const submitByIdMutation = useSubmitCheckinByVisitorId({ tenantId });

  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [state, setState] = useState<KioskState>(INITIAL_STATE);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [mode, setMode] = useState<FlowMode>("full");
  // Recognition data drives the "welcome back" banner + compact/full
  // decision. Null until the visitor finishes the Identity step.
  const [recognition, setRecognition] = useState<PublicVisitorStatusOut | null>(
    null
  );

  usePublicTenantBranding(tenantId);

  // ── Derived ──────────────────────────────────────────────────────

  const config = configQ.data;

  const bioFields = useMemo(
    () => (config?.requiredFields ?? []).filter((f) => f.category === "bio"),
    [config?.requiredFields]
  );
  const tenantFields = useMemo(
    () =>
      (config?.requiredFields ?? []).filter(
        (f) => f.category === "tenant_specific"
      ),
    [config?.requiredFields]
  );

  // ── Step helpers ─────────────────────────────────────────────────

  function advance() {
    setCompleted((prev) =>
      prev.includes(step) ? prev : [...prev, step]
    );
    setStep((s) => Math.min(s + 1, STEPS.length));
    setStepError(null);
  }

  function retreat() {
    // In compact mode we skipped step 2 on the way forward, so we have to
    // skip it on the way back too — otherwise "Back" lands on an empty
    // Verify step the visitor never saw.
    setStep((s) => {
      if (mode === "compact" && s === 3) return 1;
      return Math.max(s - 1, 1);
    });
    setStepError(null);
  }

  // ── Step 1: Identity ─────────────────────────────────────────────

  async function handleIdentityNext() {
    setStepError(null);

    const email = state.email.trim();
    const phone = state.phone.trim();

    if (!email) {
      setStepError("Email is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setStepError("Please enter a valid email address.");
      return;
    }
    if (!phone) {
      setStepError("Phone number is required.");
      return;
    }
    if (!isValidInternationalPhone(phone)) {
      setStepError(
        "Please enter a valid phone number with a country code."
      );
      return;
    }

    // Non-PII recognition probe. We branch on the response:
    //   - found=true + visitorId    → compact flow (skip Verify, minimal Details)
    //   - found=true + visitorId=null → full flow + welcome-back banner
    //   - found=false               → full flow
    //   - error                     → full flow (recognition is best-effort)
    let result: PublicVisitorStatusOut | null = null;
    try {
      result = await visitorStatusMutation.mutateAsync({ email, phone });
    } catch (err) {
      // Non-fatal: recognition failure shouldn't block check-in.
      // eslint-disable-next-line no-console
      console.warn("Visitor-status probe failed", err);
    }

    setRecognition(result);

    if (result?.found && result.visitorId) {
      // Compact flow: jump straight to Details, marking Identity + Verify
      // as completed so the progress indicator stays coherent.
      setMode("compact");
      setCompleted((prev) =>
        Array.from(new Set([...prev, 1, 2]))
      );
      setStep(3);
      return;
    }

    // Full flow. Seed identity values into the Details form so a new
    // visitor doesn't have to retype email/phone if the tenant configured
    // them as bio fields. Keys match the snake_case convention used by
    // DEFAULT_FIELDS.
    setMode("full");
    setState((s) => ({
      ...s,
      fieldValues: {
        ...s.fieldValues,
        email: s.fieldValues.email || email,
        phone: s.fieldValues.phone || phone,
      },
    }));

    advance();
  }

  // ── Step 2: Verify ───────────────────────────────────────────────

  function onUseId() {
    setState((s) => ({ ...s, useId: true }));
  }
  function onSkipId() {
    setState((s) => ({ ...s, useId: false, idFile: null, idType: null }));
    advance();
  }

  // ── Step 3: Details ──────────────────────────────────────────────

  function setFieldValue(key: string, value: unknown) {
    setState((s) => ({
      ...s,
      fieldValues: { ...s.fieldValues, [key]: value },
    }));
  }

  function handleDetailsNext() {
    setStepError(null);
    // Validate required fields. In compact mode the backend satisfies
    // `bio` fields from the stored visitor record, so only validate
    // `tenant_specific` fields — the user never saw the bio inputs.
    const missing: string[] = [];
    for (const field of config?.requiredFields ?? []) {
      if (!field.required) continue;
      if (mode === "compact" && field.category === "bio") continue;
      const v = state.fieldValues[field.key];
      if (v == null || (typeof v === "string" && v.trim() === "")) {
        missing.push(field.label);
      }
    }
    if (!state.purposeText.trim()) {
      missing.push("Purpose of visit");
    }
    if (missing.length > 0) {
      setStepError(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    advance();
  }

  // ── Step 4: Review & Submit ──────────────────────────────────────

  async function handleSubmit() {
    setStepError(null);

    const purpose: PurposeInfo = {
      purpose: state.purposeText.trim(),
      purposeDetails: state.purposeDetails.trim() || undefined,
    };

    // Collect tenant-specific field values. In compact mode this is the
    // only category we render; in full mode we also collect bio values.
    const tenantData: Record<string, unknown> = {};
    const bioData: Record<string, unknown> = {};
    for (const field of config?.requiredFields ?? []) {
      const v = state.fieldValues[field.key];
      if (v == null || v === "") continue;
      if (field.category === "tenant_specific") tenantData[field.key] = v;
      else if (field.category === "bio") bioData[field.key] = v;
    }

    // Ask the browser for the visitor's current location. This prompts
    // on first call; if the visitor denies it and the tenant has
    // geofencing enabled the backend rejects with
    // `GEOFENCE_VIOLATION / missing_visitor_location`, which we surface
    // via `describeCheckinError` below. When geofencing is disabled the
    // backend ignores the coordinates, so it's safe to send them
    // unconditionally.
    const location = await requestUserLocation();

    try {
      if (mode === "compact" && recognition?.visitorId) {
        // Minimal submit. Backend reuses stored name/email/phone/company
        // and any previously-verified ID — do not re-send them.
        const result = await submitByIdMutation.mutateAsync({
          visitorId: recognition.visitorId,
          purpose,
          tenantSpecificData: tenantData,
          visitorLat: location?.lat,
          visitorLng: location?.lng,
          visitorLocationAccuracyM: location?.accuracyM ?? undefined,
        });
        setSubmittedId(result.id);
        return;
      }

      const result = await submitFullMutation.mutateAsync({
        email: state.email.trim(),
        phone: state.phone.trim(),
        purpose,
        bioData: Object.keys(bioData).length ? bioData : undefined,
        tenantSpecificData: Object.keys(tenantData).length
          ? tenantData
          : undefined,
        idFile: state.useId ? state.idFile ?? undefined : undefined,
        idType: state.useId ? state.idType ?? undefined : undefined,
        visitorLat: location?.lat,
        visitorLng: location?.lng,
        visitorLocationAccuracyM: location?.accuracyM ?? undefined,
      });
      setSubmittedId(result.id);
    } catch (err) {
      const info = describeCheckinError(err);
      setStepError(`${info.title}: ${info.message}`);
    }
  }

  // ── Gates ─────────────────────────────────────────────────────────

  if (configQ.isLoading) {
    return <LoadingShell />;
  }

  if (configQ.isError || !config) {
    const info = describeCheckinError(configQ.error);
    return (
      <div className="mx-auto max-w-xl p-4 mt-8">
        <ErrorState
          title={info.title}
          message={info.message}
          onRetry={() => configQ.refetch()}
        />
      </div>
    );
  }

  if (submittedId) {
    return <SuccessScreen tenantName={config.tenantName} />;
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-2xl p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-3">
        {config.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.logoUrl}
            alt={`${config.tenantName} logo`}
            className="h-10 w-10 rounded object-contain"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
            <Building2
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight truncate">
            {config.tenantName}
          </p>
          <p className="text-xs text-muted-foreground">
            Visitor check-in
          </p>
        </div>
      </header>

      {mode === "compact" && recognition?.found && (
        <WelcomeBackBanner
          totalVisits={recognition.totalVisits}
          lastVisitAgoDays={recognition.lastVisitAgoDays}
        />
      )}

      <StepIndicator
        steps={STEPS}
        currentStep={step}
        completedSteps={completed}
      />

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].label}</CardTitle>
          <CardDescription>
            {step === 1 &&
              "Tell us who you are so we can find or create your visitor record."}
            {step === 2 &&
              (config.idUploadEnabled
                ? "Upload a government ID to verify yourself instantly, or skip this step."
                : "Continue — ID upload isn't required for this kiosk.")}
            {step === 3 &&
              (mode === "compact"
                ? "Just tell us the reason for today's visit."
                : "A few more details about your visit.")}
            {step === 4 && "Please review and submit."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1 */}
          {step === 1 && (
            <IdentityStep
              state={state}
              setState={setState}
              onNext={handleIdentityNext}
              isChecking={visitorStatusMutation.isPending}
              error={stepError}
            />
          )}

          {/* Step 2 — only rendered in the full flow */}
          {step === 2 && mode === "full" && (
            <VerifyStep
              config={config}
              state={state}
              setState={setState}
              onUseId={onUseId}
              onSkipId={onSkipId}
              onBack={retreat}
              onNext={advance}
            />
          )}

          {/* Step 3 */}
          {step === 3 && (
            <DetailsStep
              bioFields={mode === "compact" ? [] : bioFields}
              tenantFields={tenantFields}
              state={state}
              setState={setState}
              setFieldValue={setFieldValue}
              onBack={retreat}
              onNext={handleDetailsNext}
              error={stepError}
            />
          )}

          {/* Step 4 */}
          {step === 4 && (
            <ReviewStep
              state={state}
              config={config}
              mode={mode}
              onBack={retreat}
              onSubmit={handleSubmit}
              submitting={
                submitFullMutation.isPending || submitByIdMutation.isPending
              }
              error={stepError}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeBackBanner({
  totalVisits,
  lastVisitAgoDays,
}: {
  totalVisits: number | null;
  lastVisitAgoDays: number | null;
}) {
  const visitsLine =
    totalVisits && totalVisits > 0
      ? `You've visited ${totalVisits} ${totalVisits === 1 ? "time" : "times"} before.`
      : null;
  const lastLine =
    typeof lastVisitAgoDays === "number"
      ? lastVisitAgoDays === 0
        ? "Last visit was earlier today."
        : `Last visit was ${lastVisitAgoDays} ${lastVisitAgoDays === 1 ? "day" : "days"} ago.`
      : null;

  return (
    <div
      role="status"
      className="rounded-lg border bg-success/5 text-sm p-4 flex items-start gap-3"
    >
      <UserCheck
        className="h-5 w-5 text-success mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-medium">Welcome back!</p>
        <p className="text-muted-foreground">
          {[visitsLine, lastLine].filter(Boolean).join(" ") ||
            "We recognised you from a previous visit."}
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function LoadingShell() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <p className="text-sm">Loading kiosk…</p>
      </div>
    </div>
  );
}

function SuccessScreen({ tenantName }: { tenantName: string }) {
  return (
    <div className="mx-auto max-w-xl p-4 md:p-8 mt-8 text-center space-y-4">
      <div className="mx-auto h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-display">You&apos;re all set</h1>
      <p className="text-muted-foreground">
        Your check-in has been submitted to {tenantName} and is waiting
        for approval. Please have a seat — a receptionist will be with
        you shortly.
      </p>
    </div>
  );
}

function IdentityStep({
  state,
  setState,
  onNext,
  isChecking,
  error,
}: {
  state: KioskState;
  setState: React.Dispatch<React.SetStateAction<KioskState>>;
  onNext: () => void;
  isChecking: boolean;
  error: string | null;
}) {
  // Show the inline "invalid format" hint only after the user has typed
  // something and then blurred away — not while they're mid-typing.
  const [emailTouched, setEmailTouched] = React.useState(false);
  const emailTrimmed = state.email.trim();
  const showEmailFormatError =
    emailTouched && emailTrimmed.length > 0 && !isValidEmail(emailTrimmed);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="kiosk-email" className="text-sm">
          Email
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        </Label>
        <Input
          id="kiosk-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={state.email}
          onChange={(e) =>
            setState((s) => ({ ...s, email: e.target.value }))
          }
          onBlur={() => setEmailTouched(true)}
          aria-invalid={showEmailFormatError || undefined}
          aria-describedby={
            showEmailFormatError ? "kiosk-email-error" : undefined
          }
          className={cn(
            "text-base md:text-sm min-h-[44px]",
            showEmailFormatError &&
              "border-destructive focus-visible:ring-destructive"
          )}
          placeholder="you@example.com"
        />
        {showEmailFormatError && (
          <p
            id="kiosk-email-error"
            role="alert"
            className="text-xs text-destructive"
          >
            That doesn&apos;t look like a valid email address.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kiosk-phone" className="text-sm">
          Phone
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        </Label>
        <PhoneInput
          id="kiosk-phone"
          value={state.phone}
          onChange={(v) => setState((s) => ({ ...s, phone: v }))}
          placeholder="Phone number"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <AlertTriangle
            className="h-4 w-4 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      )}

      <div className="flex justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <LoadingButton
                onClick={onNext}
                isLoading={isChecking}
                loadingText="Checking…"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </LoadingButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Continue to identity verification
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function VerifyStep({
  config,
  state,
  setState,
  onUseId,
  onSkipId,
  onBack,
  onNext,
}: {
  config: { idUploadEnabled: boolean };
  state: KioskState;
  setState: React.Dispatch<React.SetStateAction<KioskState>>;
  onUseId: () => void;
  onSkipId: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // If the visitor already chose to upload, show the uploader directly.
  if (state.useId) {
    return (
      <div className="space-y-4">
        <IdUploadStep
          file={state.idFile}
          onFileChange={(file) => setState((s) => ({ ...s, idFile: file }))}
          idType={state.idType}
          onIdTypeChange={(t) =>
            setState((s) => ({ ...s, idType: t }))
          }
          onContinueWithoutId={() => {
            setState((s) => ({
              ...s,
              useId: false,
              idFile: null,
              idType: null,
            }));
          }}
          // We don't submit from here — the final submit is on step 4.
          // The ID file is carried along in state and sent with the payload.
          // Use the "Continue" button below to advance to Details.
          onSubmit={undefined}
        />
        <div className="flex justify-between pt-2 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Return to the identity step
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={onNext}
                  disabled={!state.idFile || !state.idType}
                >
                  Continue
                  <ArrowRight
                    className="ml-2 h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Continue to visit details — your ID is submitted on the
              final step
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {config.idUploadEnabled ? (
        <div className="space-y-2">
          <p className="text-sm">
            Verify yourself instantly by uploading a government ID.
            We&apos;ll extract your details automatically. You can also
            skip this and a receptionist will check you in manually.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onUseId}
                  className="min-h-[88px] flex-col gap-2"
                >
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                  Scan my ID
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Use your camera or upload an ID photo for instant
                verification
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onSkipId}
                  className="min-h-[88px] flex-col gap-2"
                >
                  <ClipboardList className="h-6 w-6" aria-hidden="true" />
                  Continue without ID
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Fill in your details manually — a receptionist will
                verify you after submission
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          ID verification isn&apos;t required for this kiosk. You can
          continue without uploading anything.
        </div>
      )}

      <div className="flex justify-between pt-2 border-t">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Return to the identity step
          </TooltipContent>
        </Tooltip>
        {!config.idUploadEnabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onSkipId}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Continue to visit details
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function DetailsStep({
  bioFields,
  tenantFields,
  state,
  setState,
  setFieldValue,
  onBack,
  onNext,
  error,
}: {
  bioFields: import("@/types/checkin").RequiredField[];
  tenantFields: import("@/types/checkin").RequiredField[];
  state: KioskState;
  setState: React.Dispatch<React.SetStateAction<KioskState>>;
  setFieldValue: (key: string, value: unknown) => void;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      {bioFields.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">About you</h3>
          <RequiredFieldsForm
            fields={bioFields}
            values={state.fieldValues}
            onChange={setFieldValue}
            // OCR-filled fields stay editable; the backend merges with
            // submitted wins, so visitors can correct anything.
          />
        </section>
      )}

      {tenantFields.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Additional details</h3>
          <RequiredFieldsForm
            fields={tenantFields}
            values={state.fieldValues}
            onChange={setFieldValue}
          />
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Your visit</h3>
        <div className="space-y-1.5">
          <Label htmlFor="kiosk-purpose" className="text-sm">
            Purpose of visit
            <span
              className="text-destructive ml-0.5"
              aria-hidden="true"
            >
              *
            </span>
          </Label>
          <Input
            id="kiosk-purpose"
            value={state.purposeText}
            onChange={(e) =>
              setState((s) => ({ ...s, purposeText: e.target.value }))
            }
            className="text-base md:text-sm min-h-[44px]"
            placeholder="e.g. Meeting with John"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kiosk-purpose-details" className="text-sm">
            Additional notes (optional)
          </Label>
          <Textarea
            id="kiosk-purpose-details"
            value={state.purposeDetails}
            onChange={(e) =>
              setState((s) => ({ ...s, purposeDetails: e.target.value }))
            }
            className="text-base md:text-sm min-h-[80px]"
            placeholder="Anything the receptionist should know"
          />
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <AlertTriangle
            className="h-4 w-4 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      )}

      <div className="flex justify-between pt-2 border-t">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Return to the verification step
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onNext}>
              Review
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Review your answers before submitting
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ReviewStep({
  state,
  config,
  mode,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  state: KioskState;
  config: {
    requiredFields: RequiredField[];
  };
  mode: FlowMode;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  // In compact mode the backend reuses the stored visitor record, so
  // repeating email / phone / ID on the review panel is misleading —
  // they may not even match what's on file, and we didn't collect them
  // this session anyway. Show only what was collected now.
  const showIdentity = mode === "full";
  const reviewableFields =
    mode === "compact"
      ? config.requiredFields.filter((f) => f.category === "tenant_specific")
      : config.requiredFields;

  return (
    <div className="space-y-4">
      <dl className="space-y-2 text-sm">
        {showIdentity && <ReviewItem label="Email" value={state.email} />}
        {showIdentity && <ReviewItem label="Phone" value={state.phone} />}
        {showIdentity && (
          <ReviewItem
            label="ID"
            value={
              state.useId && state.idFile
                ? `${state.idType ?? "ID"} — ${state.idFile.name}`
                : "Not provided (manual verification)"
            }
          />
        )}
        <ReviewItem label="Purpose" value={state.purposeText} />
        {state.purposeDetails && (
          <ReviewItem label="Notes" value={state.purposeDetails} />
        )}
        {reviewableFields.map((f) => {
          const v = state.fieldValues[f.key];
          if (v == null || v === "") return null;
          return (
            <ReviewItem
              key={f.key}
              label={f.label}
              value={String(v)}
            />
          );
        })}
      </dl>

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Your check-in will be sent for receptionist approval. You&apos;ll
        wait a moment until it&apos;s confirmed.
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <AlertTriangle
            className="h-4 w-4 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      )}

      <div className="flex justify-between pt-2 border-t">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={onBack}
              disabled={submitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Make edits before submitting</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <LoadingButton
                onClick={onSubmit}
                isLoading={submitting}
                loadingText={
                  state.useId
                    ? "Verifying and submitting…"
                    : "Submitting…"
                }
              >
                Submit check-in
              </LoadingButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Send your check-in to the receptionist for approval
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
