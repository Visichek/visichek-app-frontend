"use client";

/**
 * Kiosk check-in flow.
 *
 * Four steps:
 *   1. Identity — email + phone (+ returning-visitor lookup if enabled)
 *   2. Verify  — optional ID upload, OR continue without
 *   3. Details — required_fields from the check-in config
 *   4. Review  — summary + submit → pending-approval screen
 *
 * URL is keyed by tenantId (existing convention). The active check-in
 * config is resolved from the tenantId on mount.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
  useVisitorLookup,
  useSubmitCheckin,
  RequiredFieldsForm,
  IdUploadStep,
  ReturningVisitorCard,
  describeCheckinError,
} from "@/features/checkins";
import type {
  IdType,
  PurposeInfo,
  VisitorOut,
} from "@/types/checkin";
import { ApiError } from "@/types/api";

// ── Types ────────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  { id: 1, label: "Identity", icon: UserCheck },
  { id: 2, label: "Verify", icon: ShieldCheck },
  { id: 3, label: "Details", icon: ClipboardList },
  { id: 4, label: "Review", icon: CheckCircle2 },
];

/** Flow-level state that survives step navigation. */
interface KioskState {
  email: string;
  phone: string;
  returningVisitor: VisitorOut | null;
  useId: boolean; // true if the visitor chose to upload an ID
  idFile: File | null;
  idType: IdType | null;
  fieldValues: Record<string, unknown>;
  purposeText: string;
  purposeDetails: string;
}

const INITIAL_STATE: KioskState = {
  email: "",
  phone: "",
  returningVisitor: null,
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
  // `checkinConfigId === ""` is the documented "default mode" signal — the
  // tenant has not customized their config yet, so the backend returns a
  // sensible default payload. In that mode there is no config to scope the
  // returning-visitor lookup against, so we skip the lookup step.
  const configId = configQ.data?.checkinConfigId || undefined;
  const isDefaultsMode = configQ.data != null && !configId;
  const lookupMutation = useVisitorLookup(configId);
  // Per the doc, the tenant-scoped submit endpoint is the preferred path for
  // any kiosk that only knows the tenant_id (our case — the URL is
  // /register/[tenantId]). It resolves the tenant's active config server-side
  // and falls back to defaults when none exists, so we always use it here.
  const submitMutation = useSubmitCheckin({ configId: undefined, tenantId });

  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [state, setState] = useState<KioskState>(INITIAL_STATE);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Apply tenant logo as a page-level visual cue only
  useEffect(() => {
    if (configQ.data?.logoUrl) {
      // Kept simple — branding system handles CSS vars separately.
    }
  }, [configQ.data?.logoUrl]);

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
    setStep((s) => Math.max(s - 1, 1));
    setStepError(null);
  }

  // ── Step 1: Identity ─────────────────────────────────────────────

  async function handleIdentityNext() {
    setStepError(null);

    if (!state.email.trim() && !state.phone.trim()) {
      setStepError("Please enter your email or phone number.");
      return;
    }
    if (!state.email.trim()) {
      setStepError("Email is required.");
      return;
    }
    if (!state.phone.trim()) {
      setStepError("Phone number is required.");
      return;
    }

    // Optional returning-visitor lookup. Skipped in defaults mode — there is
    // no config id to scope the lookup to, and the backend lookup endpoint is
    // keyed by configId.
    if (
      !isDefaultsMode &&
      config?.allowReturningVisitorLookup &&
      !state.returningVisitor
    ) {
      try {
        const match = await lookupMutation.mutateAsync({
          email: state.email.trim() || undefined,
          phone: state.phone.trim() || undefined,
        });
        if (match) {
          setState((s) => ({ ...s, returningVisitor: match }));
          // Stop here — let the visitor confirm the match before moving on.
          return;
        }
      } catch (err) {
        // Non-fatal: lookup failure shouldn't block check-in.
        // eslint-disable-next-line no-console
        console.warn("Returning-visitor lookup failed", err);
      }
    }

    advance();
  }

  function confirmReturningVisitor() {
    const v = state.returningVisitor;
    if (!v) return;
    // Prefill identity + bio data from the saved profile.
    setState((s) => ({
      ...s,
      email: v.email || s.email,
      phone: v.phone || s.phone,
      fieldValues: {
        ...s.fieldValues,
        // Map a couple of common bio keys; anything not present is ignored.
        full_name: v.fullName,
        ...v.bioData,
      },
    }));
    advance();
  }

  function dismissReturningVisitor() {
    setState((s) => ({ ...s, returningVisitor: null }));
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
    // Validate required fields
    const missing: string[] = [];
    for (const field of config?.requiredFields ?? []) {
      if (!field.required) continue;
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

    // Split fieldValues by category
    const bioData: Record<string, unknown> = {};
    const tenantData: Record<string, unknown> = {};
    for (const field of config?.requiredFields ?? []) {
      const v = state.fieldValues[field.key];
      if (v == null || v === "") continue;
      if (field.category === "bio") bioData[field.key] = v;
      else if (field.category === "tenant_specific")
        tenantData[field.key] = v;
    }

    try {
      const result = await submitMutation.mutateAsync({
        email: state.email.trim(),
        phone: state.phone.trim(),
        purpose,
        bioData: Object.keys(bioData).length ? bioData : undefined,
        tenantSpecificData: Object.keys(tenantData).length
          ? tenantData
          : undefined,
        idFile: state.useId ? state.idFile ?? undefined : undefined,
        idType: state.useId ? state.idType ?? undefined : undefined,
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
              "A few more details about your visit."}
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
              isLookingUp={lookupMutation.isPending}
              error={stepError}
              onConfirmReturning={confirmReturningVisitor}
              onDismissReturning={dismissReturningVisitor}
            />
          )}

          {/* Step 2 */}
          {step === 2 && (
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
              bioFields={bioFields}
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
              onBack={retreat}
              onSubmit={handleSubmit}
              submitting={submitMutation.isPending}
              error={stepError}
            />
          )}
        </CardContent>
      </Card>
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
  isLookingUp,
  error,
  onConfirmReturning,
  onDismissReturning,
}: {
  state: KioskState;
  setState: React.Dispatch<React.SetStateAction<KioskState>>;
  onNext: () => void;
  isLookingUp: boolean;
  error: string | null;
  onConfirmReturning: () => void;
  onDismissReturning: () => void;
}) {
  if (state.returningVisitor) {
    return (
      <ReturningVisitorCard
        visitor={state.returningVisitor}
        onUseProfile={onConfirmReturning}
        onDismiss={onDismissReturning}
      />
    );
  }

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
          className="text-base md:text-sm min-h-[44px]"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kiosk-phone" className="text-sm">
          Phone
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        </Label>
        <Input
          id="kiosk-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={state.phone}
          onChange={(e) =>
            setState((s) => ({ ...s, phone: e.target.value }))
          }
          className="text-base md:text-sm min-h-[44px]"
          placeholder="+234 …"
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
                isLoading={isLookingUp}
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
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  state: KioskState;
  config: {
    requiredFields: import("@/types/checkin").RequiredField[];
  };
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <dl className="space-y-2 text-sm">
        <ReviewItem label="Email" value={state.email} />
        <ReviewItem label="Phone" value={state.phone} />
        <ReviewItem
          label="ID"
          value={
            state.useId && state.idFile
              ? `${state.idType ?? "ID"} — ${state.idFile.name}`
              : "Not provided (manual verification)"
          }
        />
        <ReviewItem label="Purpose" value={state.purposeText} />
        {state.purposeDetails && (
          <ReviewItem label="Notes" value={state.purposeDetails} />
        )}
        {config.requiredFields.map((f) => {
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
