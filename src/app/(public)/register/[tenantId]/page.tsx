"use client";

/**
 * Kiosk check-in flow (v2).
 *
 * Steps:
 *   1. Identity   — full_name (req), phone (req), email (opt)
 *   2. Details    — config-driven bio + tenant_specific fields, including
 *                   the `purpose_of_visit` enum picker. Notes are not a
 *                   built-in field; a tenant collects them by adding a
 *                   text/long_text field to their check-in config.
 *   3. Review     — final summary
 *   4. KYC option — "Verify with Dojah" or "Skip" (the last step, shown only
 *                   when the tenant's plan grants KYC, i.e. `idUploadEnabled`
 *                   on the public config). Submitting happens here; on the
 *                   Review step when KYC is unavailable.
 *   5. Post-submit — submit; switch on response.state:
 *        - pending_approval → wait-for-receptionist screen
 *        - pending_verification + intent="verify" → POST /v1/kyc/initiate, render
 *          the Dojah widget, and (on close) poll /kyc/status until the
 *          webhook resolves the verification
 *        - pending_verification + intent="skip" → POST /v1/kyc/skip, then wait
 *
 * The frontend never reads Dojah credentials from environment variables —
 * the widget config is provided whole by the backend on /kyc/initiate.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { parsePhone } from "@/lib/constants/countries";
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
  useCheckinEnumsForTenant,
  useSubmitCheckin,
  useKycInitiate,
  useKycSkip,
  useKycStatus,
  useVerifyRegistrationToken,
  RequiredFieldsForm,
  KycWidget,
  KycStatusScreen,
  describeCheckinError,
  checkinKeys,
} from "@/features/checkins";
import type { KycStatusScreenState } from "@/features/checkins";
import { ApiError } from "@/types/api";
import { usePublicTenantBranding } from "@/hooks/use-public-tenant-branding";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useWizard } from "@/hooks/use-wizard";
import { requestUserLocation } from "@/lib/geolocation/user-location";
import type {
  CheckinOut,
  PurposeInfo,
  RequiredField,
} from "@/types/checkin";
import type { KycWidgetConfig } from "@/types/kyc";
import type { PublicPrivacyNotice } from "@/types/public";
import { usePublicPrivacyNotice } from "@/features/public-registration/hooks/use-public-registration";
import { PrivacyNoticeDisplay } from "@/features/public-registration/components/privacy-notice-display";

// ── Constants ────────────────────────────────────────────────────────

/**
 * Field keys collected on the fixed Identity step. We render these as a
 * dedicated UI in step 1 and exclude them from the config-driven Details
 * form even if the tenant lists them in `requiredFields`.
 */
const IDENTITY_KEYS = new Set(["full_name", "phone", "email"]);

/** Field key reserved for the purpose-of-visit picker. */
const PURPOSE_KEY = "purpose";

const STEPS: StepDef[] = [
  { id: 1, label: "Identity", icon: UserCheck },
  { id: 2, label: "Details", icon: ClipboardList },
  { id: 3, label: "Review", icon: CheckCircle2 },
  { id: 4, label: "Verify", icon: ShieldCheck },
];

/** Step indicator without the Verify step (when KYC isn't available). */
const STEPS_NO_KYC: StepDef[] = [
  { id: 1, label: "Identity", icon: UserCheck },
  { id: 2, label: "Details", icon: ClipboardList },
  { id: 3, label: "Review", icon: CheckCircle2 },
];

// ── Validation helpers ──────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function isValidInternationalPhone(value: string): boolean {
  const parsed = parsePhone(value);
  if (!parsed) return false;
  const digits = parsed.national.replace(/[^\d]/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

// ── Types ────────────────────────────────────────────────────────────

type KycIntent = "verify" | "skip";

interface KioskState {
  fullName: string;
  phone: string;
  email: string;
  /** Set on the final Verify step; null if KYC isn't available on this tenant. */
  kycIntent: KycIntent | null;
  /** Config-driven field values keyed by field.key. */
  fieldValues: Record<string, unknown>;
  /**
   * Whether the visitor accepted the tenant's privacy notice / terms. Only
   * meaningful when the active notice's `displayMode` is `active_consent`;
   * gates entry to the wizard in that case.
   */
  consentAccepted: boolean;
  /**
   * Unix epoch seconds at which the visitor accepted the privacy notice.
   * Sent as `consent_accepted_at` on submit to populate the consent audit
   * record; null until accepted.
   */
  consentAcceptedAt: number | null;
}

const INITIAL_STATE: KioskState = {
  fullName: "",
  phone: "",
  email: "",
  kycIntent: null,
  fieldValues: {},
  consentAccepted: false,
  consentAcceptedAt: null,
};

// ── Local persistence ────────────────────────────────────────────────
// The kiosk persists collected details + step so a refresh resumes where the
// visitor left off. This is intentional local-only state (localStorage):
// no tokens, no server-side persistence, consistent with the auth-cookie
// rules. We bump the version to drop stale drafts when the shape changes.
// v2 adds `consentAccepted` to the persisted kiosk state.
// v3 drops the freeform `purposeDetails` notes field, adds
// `consentAcceptedAt`, and reorders the wizard (Verify is now the last step
// after Review) — bump so stale cursors/drafts from the old order are dropped.
const KIOSK_PERSIST_VERSION = 3;
/** Form draft + wizard cursor — a kiosk session window. */
const KIOSK_TTL_MS = 30 * 60 * 1000;
/** KYC resume marker — shorter, since the verification window is brief. */
const KYC_TTL_MS = 15 * 60 * 1000;
/** On a terminal/wait screen, wipe everything after this much inactivity so a
 *  shared kiosk doesn't leak one visitor's data to the next. */
const IDLE_RESET_MS = 3 * 60 * 1000;

/**
 * Minimal, resumable snapshot of the post-submit KYC phase. We persist this
 * — never the live `widgetConfig`, which is short-lived and re-minted via
 * `/kyc/initiate` on resume. `fullName` / `email` are copied so the wait
 * screen still renders after the form draft is cleared on terminal.
 */
interface KycMarker {
  kind:
    | "awaiting_kyc"
    | "kyc_polling"
    | "kyc_verifying"
    | "kyc_failed"
    | "awaiting_approval";
  checkin: CheckinOut;
  kycIntent: KycIntent | null;
  reason?: string;
  fullName?: string;
  email?: string;
}

/**
 * Post-submit state machine. `idle` while collecting; transitions move
 * forward only — restart by reloading the kiosk.
 */
type KycPhase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "awaiting_approval";
      checkin: CheckinOut;
      /**
       * True when the visitor explicitly chose "Verify with Dojah" on
       * step 2 but the backend returned `state: "pending_approval"`
       * directly (the v2 doc's "silent degrade" path — plan doesn't
       * grant /v1/kyc/*). Drives an extra info note on the wait screen
       * so the visitor isn't left wondering why no widget opened.
       */
      kycSilentlySkipped?: boolean;
    }
  | { kind: "kyc_initiating"; checkin: CheckinOut }
  | { kind: "kyc_running"; checkin: CheckinOut; widgetConfig: KycWidgetConfig }
  | { kind: "kyc_polling"; checkin: CheckinOut }
  | { kind: "kyc_verifying"; checkin: CheckinOut }
  | { kind: "kyc_failed"; checkin: CheckinOut; reason?: string }
  | { kind: "kyc_skipping"; checkin: CheckinOut };

// ── Page ─────────────────────────────────────────────────────────────

export default function KioskCheckinPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  // Issue 5: department QR tokens. The QR page mints
  //   /register/{tenantId}?token=<signed_jwt>
  // and the backend can verify the token's tenant/department/branch
  // scope before the form is shown. When verification fails we still
  // render the kiosk in generic mode — the visitor can finish, just
  // without the locked department context.
  const searchParams = useSearchParams();
  const registrationToken = searchParams?.get("token") ?? null;
  const tokenVerifyQ = useVerifyRegistrationToken(registrationToken);
  const tokenScope = tokenVerifyQ.data?.valid ? tokenVerifyQ.data : null;
  const tokenInvalid =
    !!registrationToken &&
    !tokenVerifyQ.isLoading &&
    tokenVerifyQ.data?.valid === false;

  const configQ = useActiveCheckinConfigForTenant(tenantId);
  const enumsQ = useCheckinEnumsForTenant(tenantId);
  // Tenant's visitor-facing privacy notice. When its displayMode is
  // `active_consent`, the visitor must accept it before the wizard opens.
  const privacyNoticeQ = usePublicPrivacyNotice(tenantId);

  const submitMutation = useSubmitCheckin({ configId: undefined, tenantId });
  const kycInitiateMutation = useKycInitiate();
  const kycSkipMutation = useKycSkip();
  const queryClient = useQueryClient();

  // Per-tenant persistence scope; a department-scoped QR link gets its own
  // bucket so it doesn't collide with the generic kiosk on the same device.
  const persistScope = `${tenantId}:${registrationToken ? "scoped" : "generic"}`;
  const [state, setState, stateControls] = usePersistentState<KioskState>(
    `visichek:kiosk:${persistScope}`,
    INITIAL_STATE,
    { ttlMs: KIOSK_TTL_MS, version: KIOSK_PERSIST_VERSION },
  );
  const [kycMarker, setKycMarker, kycMarkerControls] =
    usePersistentState<KycMarker | null>(
      `visichek:kiosk-kyc:${persistScope}`,
      null,
      { ttlMs: KYC_TTL_MS, version: KIOSK_PERSIST_VERSION },
    );
  const [stepError, setStepError] = useState<string | null>(null);
  const [phase, setPhase] = useState<KycPhase>({ kind: "idle" });
  const [refillDismissed, setRefillDismissed] = useState(false);

  usePublicTenantBranding(tenantId);

  // ── Derived ──────────────────────────────────────────────────────

  const config = configQ.data;
  const enums = enumsQ.data;
  const kycAvailable = !!config?.idUploadEnabled;

  const privacyNotice = privacyNoticeQ.data ?? null;
  /** Notice requires an explicit "I accept" before the visitor may proceed. */
  const consentRequired = privacyNotice?.displayMode === "active_consent";
  /** Show the gate until the visitor accepts (only when required). */
  const consentGateOpen = consentRequired && !state.consentAccepted;

  function acceptConsent() {
    setStepError(null);
    setState((s) => ({
      ...s,
      consentAccepted: true,
      consentAcceptedAt: Math.floor(Date.now() / 1000),
    }));
  }

  const detailsFields = useMemo<RequiredField[]>(() => {
    if (!config) return [];
    return config.requiredFields.filter((f) => !IDENTITY_KEYS.has(f.key));
  }, [config]);

  const visibleSteps = kycAvailable ? STEPS : STEPS_NO_KYC;

  // ── Step navigation ──────────────────────────────────────────────
  // Steps are contiguous (1=Identity, 2=Details, 3=Review, and 4=Verify
  // only when KYC is available), so the wizard's default index-based
  // advance/retreat handles ordering — no custom resolvers needed.

  const wizard = useWizard({
    steps: kycAvailable ? [1, 2, 3, 4] : [1, 2, 3],
    persist: {
      key: `visichek:kiosk-wizard:${persistScope}`,
      ttlMs: KIOSK_TTL_MS,
      version: KIOSK_PERSIST_VERSION,
    },
  });
  const step = wizard.step;
  const completed = wizard.completed;

  function advance() {
    setStepError(null);
    wizard.advance();
  }
  function retreat() {
    setStepError(null);
    wizard.retreat();
  }

  /** Wipe every kiosk key and return to a clean step 1. */
  function resetKiosk() {
    stateControls.clear();
    kycMarkerControls.clear();
    setKycMarker(null);
    setState(INITIAL_STATE);
    setStepError(null);
    setRefillDismissed(false);
    setPhase({ kind: "idle" });
    wizard.reset();
  }

  // ── Step 1: Identity ─────────────────────────────────────────────

  function handleIdentityNext() {
    setStepError(null);
    const fullName = state.fullName.trim();
    const phone = state.phone.trim();
    const email = state.email.trim();

    if (!fullName) {
      setStepError("Full name is required.");
      return;
    }
    if (!phone) {
      setStepError("Phone number is required.");
      return;
    }
    if (!isValidInternationalPhone(phone)) {
      setStepError("Please enter a valid phone number with a country code.");
      return;
    }
    if (email && !isValidEmail(email)) {
      setStepError("That email address doesn't look right.");
      return;
    }
    advance();
  }

  // ── Step 4: KYC option (final step) ──────────────────────────────

  /**
   * Record the visitor's choice without advancing — the choice surfaces a
   * confirmation message and unlocks the explicit Submit button. We do not
   * auto-submit because both options would otherwise look identical and the
   * visitor can't tell their click landed.
   */
  function chooseIntent(intent: KycIntent) {
    setState((s) => ({ ...s, kycIntent: intent }));
    setStepError(null);
  }

  // ── Step 2: Details ──────────────────────────────────────────────

  function setFieldValue(key: string, value: unknown) {
    setState((s) => ({
      ...s,
      fieldValues: { ...s.fieldValues, [key]: value },
    }));
  }

  function handleDetailsNext() {
    setStepError(null);
    const missing: string[] = [];
    for (const field of detailsFields) {
      if (!field.required) continue;
      const v = state.fieldValues[field.key];
      if (v == null || (typeof v === "string" && v.trim() === "")) {
        missing.push(field.label);
      }
    }
    if (missing.length > 0) {
      setStepError(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    advance();
  }

  // ── Step 3 + post-submit: Review and submit ──────────────────────

  /**
   * Build the multipart payload from state. The kiosk collects identity
   * fields on step 1 and merges them into `bio_data`; the structured
   * `purpose` field carries the picker value. Any free-text notes are a
   * tenant-configured `tenant_specific` field, so they ride in
   * `tenant_specific_data` rather than on `purpose`.
   */
  function buildSubmitPayload(location: { lat: number; lng: number; accuracyM: number | null } | null) {
    const purposeValue =
      typeof state.fieldValues[PURPOSE_KEY] === "string"
        ? (state.fieldValues[PURPOSE_KEY] as string)
        : "";
    const purpose: PurposeInfo = {
      purpose: purposeValue.trim(),
    };

    const bioData: Record<string, unknown> = {
      full_name: state.fullName.trim(),
    };
    const tenantData: Record<string, unknown> = {};

    if (state.email.trim()) {
      bioData.email = state.email.trim();
    }

    for (const field of config?.requiredFields ?? []) {
      const v = state.fieldValues[field.key];
      if (v == null || v === "") continue;
      if (field.category === "bio") {
        if (IDENTITY_KEYS.has(field.key)) continue;
        bioData[field.key] = v;
      } else if (field.category === "tenant_specific") {
        tenantData[field.key] = v;
      }
    }

    return {
      email: state.email.trim() || undefined,
      phone: state.phone.trim(),
      purpose,
      bioData,
      tenantSpecificData: Object.keys(tenantData).length ? tenantData : undefined,
      visitorLat: location?.lat,
      visitorLng: location?.lng,
      visitorLocationAccuracyM: location?.accuracyM ?? undefined,
      // Issue 5: when a department QR was scanned, forward the signed
      // token so the backend can pin the visit to the right
      // tenant/department/branch and write the token id into the
      // audit record. Only attach valid tokens — passing an expired
      // token would just produce a SCOPE_MISMATCH on submit.
      registrationToken:
        registrationToken && tokenScope?.valid ? registrationToken : undefined,
      // Privacy-notice consent. We only attach it when the visitor actually
      // accepted (the consent gate enforces this for `active_consent`
      // notices); the notice id/version + timestamp populate the consent
      // audit record. Without this an `active_consent` tenant rejects the
      // submit with 422 CONSENT_REQUIRED.
      consentGranted: state.consentAccepted || undefined,
      consentMethod: state.consentAccepted ? "kiosk_checkbox" : undefined,
      privacyNoticeId: state.consentAccepted ? privacyNotice?.id : undefined,
      privacyNoticeVersionId: state.consentAccepted
        ? privacyNotice?.versionId
        : undefined,
      consentAcceptedAt: state.consentAccepted
        ? state.consentAcceptedAt ?? undefined
        : undefined,
    };
  }

  async function handleSubmit() {
    setStepError(null);
    setPhase({ kind: "submitting" });
    try {
      const location = await requestUserLocation();
      const payload = buildSubmitPayload(location);
      const checkin = await submitMutation.mutateAsync(payload);
      await routePostSubmit(checkin);
    } catch (err) {
      const info = describeCheckinError(err);
      setStepError(`${info.title}: ${info.message}`);
      setPhase({ kind: "idle" });
    }
  }

  /**
   * Branch on the submit response. `pending_approval` jumps straight to
   * the wait screen; `pending_verification` runs the KYC widget or the skip path
   * depending on what the visitor chose on step 2.
   */
  async function routePostSubmit(checkin: CheckinOut) {
    if (checkin.state !== "pending_verification") {
      // Silent-degrade detection: visitor opted in to verification but the
      // backend returned `pending_approval` anyway — typically because the
      // tenant's plan doesn't grant `/v1/kyc/*`. Surface this on the wait
      // screen so the visitor knows why no widget appeared.
      const kycSilentlySkipped = state.kycIntent === "verify";
      setPhase({ kind: "awaiting_approval", checkin, kycSilentlySkipped });
      return;
    }

    // KYC required by backend, but tenant didn't expose the option on the
    // public config. Default to verify so the visitor isn't stuck.
    const intent: KycIntent = state.kycIntent ?? "verify";

    if (intent === "skip") {
      await runKycSkip(checkin);
      return;
    }
    await runKycInitiate(checkin);
  }

  async function runKycInitiate(checkin: CheckinOut) {
    // Drop any cached `/kyc/status` payload from a prior attempt on the
    // same checkin — otherwise the polling useEffect could resolve the
    // new attempt against stale terminal data the moment we re-enable it.
    queryClient.removeQueries({ queryKey: checkinKeys.kycStatus(checkin.id) });
    setPhase({ kind: "kyc_initiating", checkin });
    try {
      const result = await kycInitiateMutation.mutateAsync({
        checkinId: checkin.id,
        capabilityToken: checkin.capabilityToken ?? "",
      });
      setPhase({
        kind: "kyc_running",
        checkin,
        widgetConfig: result.widgetConfig,
      });
    } catch (err) {
      // 402 FEATURE_DISABLED → KYC isn't on this plan; treat as skip-like
      // success so the kiosk can proceed to the wait screen.
      if (err instanceof ApiError && err.code === "FEATURE_DISABLED") {
        setPhase({
          kind: "awaiting_approval",
          checkin,
          kycSilentlySkipped: true,
        });
        return;
      }
      const info = describeCheckinError(err);
      setPhase({
        kind: "kyc_failed",
        checkin,
        reason: `${info.title}: ${info.message}`,
      });
    }
  }

  async function runKycSkip(checkin: CheckinOut) {
    setPhase({ kind: "kyc_skipping", checkin });
    try {
      await kycSkipMutation.mutateAsync({
        checkinId: checkin.id,
        reason: "visitor declined",
        capabilityToken: checkin.capabilityToken ?? "",
      });
      setPhase({ kind: "awaiting_approval", checkin });
    } catch (err) {
      // 403 FEATURE_DISABLED here means the tenant has kyc_required: true
      // and the visitor cannot skip — fall back to launching the widget.
      if (err instanceof ApiError && err.code === "FEATURE_DISABLED") {
        setState((s) => ({ ...s, kycIntent: "verify" }));
        await runKycInitiate(checkin);
        return;
      }
      const info = describeCheckinError(err);
      setPhase({
        kind: "kyc_failed",
        checkin,
        reason: `${info.title}: ${info.message}`,
      });
    }
  }

  // ── KYC widget event handling ────────────────────────────────────

  function onKycEvent(type: string) {
    if (phase.kind !== "kyc_running") return;
    if (type === "success") {
      setPhase({ kind: "kyc_verifying", checkin: phase.checkin });
    } else if (type === "error") {
      setPhase({
        kind: "kyc_failed",
        checkin: phase.checkin,
        reason: "The widget reported an error before finishing.",
      });
    } else if (type === "close") {
      setPhase({ kind: "kyc_polling", checkin: phase.checkin });
    }
    // 'loading' / 'begin' are visual-only.
  }

  // ── Status polling ───────────────────────────────────────────────

  const pollingCheckin =
    phase.kind === "kyc_polling" || phase.kind === "kyc_verifying"
      ? phase.checkin
      : undefined;
  const pollingCheckinId = pollingCheckin?.id;
  const statusQ = useKycStatus(
    pollingCheckinId,
    pollingCheckin?.capabilityToken,
    { enabled: !!pollingCheckinId },
  );

  useEffect(() => {
    if (!statusQ.data) return;
    if (phase.kind !== "kyc_polling" && phase.kind !== "kyc_verifying") return;

    const status = statusQ.data.status;
    if (status === "ongoing") return;
    if (status === "success" || status === "skipped") {
      setPhase({ kind: "awaiting_approval", checkin: phase.checkin });
    } else if (status === "failed" || status === "expired") {
      setPhase({
        kind: "kyc_failed",
        checkin: phase.checkin,
        reason: statusQ.data.failureReason ?? undefined,
      });
    }
  }, [statusQ.data, phase]);

  // ── KYC resume marker persistence ─────────────────────────────────
  // Mirror the post-submit phase to a minimal localStorage marker so a
  // refresh resumes verification. Never persist `widgetConfig`.
  useEffect(() => {
    if (!stateControls.hydrated) return;
    switch (phase.kind) {
      case "idle":
      case "submitting":
        // Transient — nothing durable to resume. (A refresh mid-submit lands
        // back on Review; see the submit-during-refresh note in the plan.)
        break;
      case "kyc_initiating":
      case "kyc_running":
      case "kyc_skipping":
        setKycMarker({
          kind: "awaiting_kyc",
          checkin: phase.checkin,
          kycIntent: state.kycIntent,
          fullName: state.fullName,
          email: state.email,
        });
        break;
      case "kyc_polling":
      case "kyc_verifying":
        setKycMarker({
          kind: phase.kind,
          checkin: phase.checkin,
          kycIntent: state.kycIntent,
          fullName: state.fullName,
          email: state.email,
        });
        break;
      case "kyc_failed":
        setKycMarker({
          kind: "kyc_failed",
          checkin: phase.checkin,
          kycIntent: state.kycIntent,
          reason: phase.reason,
          fullName: state.fullName,
          email: state.email,
        });
        break;
      case "awaiting_approval":
        setKycMarker({
          kind: "awaiting_approval",
          checkin: phase.checkin,
          kycIntent: state.kycIntent,
          fullName: state.fullName,
          email: state.email,
        });
        // Terminal: drop the form draft + wizard cursor so a refresh resumes
        // the wait screen (from the marker), not a pre-filled form.
        stateControls.clear();
        wizard.reset();
        break;
    }
    // Intentionally keyed on `phase` only — `state` values are stable by the
    // time we're in a KYC phase, and we don't want to rewrite on keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stateControls.hydrated]);

  // ── Resume on mount ───────────────────────────────────────────────
  // Once the marker has hydrated, reconstruct the live phase and kick the
  // matching action. Runs at most once.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (!kycMarkerControls.hydrated) return;
    resumedRef.current = true;
    const marker = kycMarker;
    if (!marker || phase.kind !== "idle") return;

    if (marker.kind === "awaiting_kyc") {
      if (marker.kycIntent === "skip") void runKycSkip(marker.checkin);
      else void runKycInitiate(marker.checkin);
    } else if (marker.kind === "kyc_polling") {
      setPhase({ kind: "kyc_polling", checkin: marker.checkin });
    } else if (marker.kind === "kyc_verifying") {
      setPhase({ kind: "kyc_verifying", checkin: marker.checkin });
    } else if (marker.kind === "kyc_failed") {
      setPhase({
        kind: "kyc_failed",
        checkin: marker.checkin,
        reason: marker.reason,
      });
    } else if (marker.kind === "awaiting_approval") {
      setPhase({ kind: "awaiting_approval", checkin: marker.checkin });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kycMarkerControls.hydrated]);

  // ── Idle hygiene on terminal screens ──────────────────────────────
  // On a shared kiosk, wipe everything after a few minutes idle on the wait
  // screen so the next visitor starts clean.
  useEffect(() => {
    if (phase.kind !== "awaiting_approval" && phase.kind !== "kyc_failed") {
      return;
    }
    const timer = setTimeout(() => resetKiosk(), IDLE_RESET_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind]);

  function retryKyc() {
    if (phase.kind !== "kyc_failed") return;
    void runKycInitiate(phase.checkin);
  }

  // ── Gates ─────────────────────────────────────────────────────────

  // Wait for the privacy notice too so we never flash the wizard and then
  // snap to the consent gate. On error it resolves to "no notice" and the
  // flow proceeds (fail-open) rather than blocking check-in on a fetch hiccup.
  if (configQ.isLoading || privacyNoticeQ.isLoading) return <LoadingShell />;

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

  // ── Render ────────────────────────────────────────────────────────

  // Post-submit phases own the screen.
  if (phase.kind !== "idle" && phase.kind !== "submitting") {
    return (
      <KioskShell config={config}>
        <PostSubmitScreen
          phase={phase}
          tenantName={config.tenantName}
          onKycEvent={onKycEvent}
          onRetry={retryKyc}
          retrying={kycInitiateMutation.isPending}
          fullName={state.fullName || kycMarker?.fullName || ""}
          email={state.email || kycMarker?.email || ""}
        />
      </KioskShell>
    );
  }

  // Consent gate: when the tenant's privacy notice requires explicit
  // consent, the visitor must accept it before any data is collected.
  if (consentGateOpen && privacyNotice) {
    return (
      <KioskShell config={config}>
        <PrivacyConsentGate
          notice={privacyNotice}
          onAccept={acceptConsent}
        />
      </KioskShell>
    );
  }

  return (
    <KioskShell config={config}>
      {/* Passive notice: shown for information only (no acceptance needed). */}
      {privacyNotice && !consentRequired && step === 1 && (
        <PrivacyNoticeDisplay notice={privacyNotice} />
      )}

      {/* Issue 5: scoped QR banner — confirms which department's QR
          the visitor scanned so they can tell they're in the right
          flow. Renders only when the backend confirmed the token. */}
      {tokenScope && (
        <div
          role="status"
          className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-start gap-2"
        >
          <Building2
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-medium">
              Department-scoped registration
            </p>
            <p className="text-muted-foreground">
              You scanned a registration QR for{" "}
              <span className="font-medium">
                {tokenScope.companyName ?? config.tenantName}
              </span>
              . Your visit will be routed to the configured department
              automatically.
            </p>
          </div>
        </div>
      )}

      {tokenInvalid && (
        <div
          role="status"
          className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs flex items-start gap-2"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-medium">QR token expired or invalid</p>
            <p className="text-muted-foreground">
              We couldn&apos;t verify the QR you scanned, so you&apos;ll
              register without a pre-selected department. Ask the front
              desk for a fresh QR if you need one.
            </p>
          </div>
        </div>
      )}

      {config.publicSelfCheckinEnabled === false && (
        <div
          role="status"
          className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs flex items-start gap-2"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-medium">Reception-assisted check-in</p>
            <p className="text-muted-foreground">
              This tenant&apos;s plan does not include unattended public
              check-ins. Please ask a receptionist to start your check-in
              so it can be submitted from their reception session.
            </p>
          </div>
        </div>
      )}

      {/* Suggestive re-fill: a returning visitor on this device sees their
          previously-entered identity as a suggestion they can keep or clear.
          Local data is a typing shortcut only — never identity proof. */}
      {stateControls.hydrated &&
        step === 1 &&
        !refillDismissed &&
        (state.fullName.trim() !== "" || state.phone.trim() !== "") && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
          >
            <span className="min-w-0">
              Welcome back
              {state.fullName.trim() ? (
                <>
                  {" — continue as "}
                  <span className="font-medium">{state.fullName.trim()}</span>?
                </>
              ) : (
                <>? We restored your details.</>
              )}
            </span>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRefillDismissed(true)}
              >
                Use these
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetKiosk}
              >
                Not me
              </Button>
            </div>
          </div>
        )}

      <StepIndicator
        steps={visibleSteps}
        currentStep={step}
        completedSteps={completed}
      />

      <Card>
        <CardHeader>
          <CardTitle>{titleForStep(step, kycAvailable)}</CardTitle>
          <CardDescription>{descriptionForStep(step, kycAvailable)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <IdentityStep
              state={state}
              setState={setState}
              onNext={handleIdentityNext}
              error={stepError}
            />
          )}

          {step === 2 && (
            <DetailsStep
              fields={detailsFields}
              enums={enumsQ.data}
              fieldValues={state.fieldValues}
              setFieldValue={setFieldValue}
              onBack={retreat}
              onNext={handleDetailsNext}
              error={stepError}
            />
          )}

          {step === 3 && (
            <ReviewStep
              state={state}
              fields={detailsFields}
              enums={enums}
              // When KYC is available, Review hands off to the final Verify
              // step (Continue); otherwise Review is the last step and
              // submits directly.
              kycAvailable={kycAvailable}
              onBack={retreat}
              onContinue={advance}
              onSubmit={handleSubmit}
              submitting={phase.kind === "submitting"}
              error={stepError}
            />
          )}

          {step === 4 && kycAvailable && (
            <KycOptionStep
              intent={state.kycIntent}
              onChoose={chooseIntent}
              onBack={retreat}
              onSubmit={handleSubmit}
              submitting={phase.kind === "submitting"}
              error={stepError}
            />
          )}
        </CardContent>
      </Card>
    </KioskShell>
  );
}

// ── Privacy consent gate ─────────────────────────────────────────────

/**
 * Blocking consent screen shown before the check-in wizard when the
 * tenant's active privacy notice has `displayMode: "active_consent"`. The
 * visitor reads the notice and must tick the acceptance box before the
 * Continue button unlocks.
 */
function PrivacyConsentGate({
  notice,
  onAccept,
}: {
  notice: PublicPrivacyNotice;
  onAccept: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!checked) {
      setError("Please accept the privacy policy and terms to continue.");
      return;
    }
    onAccept();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before you check in</CardTitle>
        <CardDescription>
          Please review and accept our privacy policy and terms to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PrivacyNoticeDisplay notice={notice} />

        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="kiosk-consent"
              checked={checked}
              onCheckedChange={(value) => {
                const next = value === true;
                setChecked(next);
                if (next) setError(null);
              }}
              className="mt-0.5 h-5 w-5"
              aria-invalid={!!error}
              aria-describedby={error ? "kiosk-consent-error" : undefined}
            />
            <Label
              htmlFor="kiosk-consent"
              className="text-sm font-medium leading-relaxed cursor-pointer"
            >
              I have read and accept the privacy policy and terms above.
            </Label>
          </div>
          {error && (
            <p
              id="kiosk-consent-error"
              className="mt-2 text-xs text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={handleContinue}
          disabled={!checked}
          className="min-h-[44px] w-full"
        >
          Accept &amp; continue
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Layout ───────────────────────────────────────────────────────────

function KioskShell({
  config,
  children,
}: {
  config: { tenantName: string; logoUrl?: string };
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-3">
        {config.logoUrl ? (
          <Image
            src={config.logoUrl}
            alt={`${config.tenantName} logo`}
            width={40}
            height={40}
            priority
            unoptimized={config.logoUrl.endsWith(".svg")}
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
          <p className="text-xs text-muted-foreground">Visitor check-in</p>
        </div>
      </header>
      {children}
    </div>
  );
}

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

function titleForStep(step: number, kycAvailable: boolean): string {
  if (step === 1) return "Identity";
  if (step === 2) return "Details";
  if (step === 3) return "Review";
  if (step === 4 && kycAvailable) return "Verify your ID";
  return "";
}

function descriptionForStep(step: number, kycAvailable: boolean): string {
  if (step === 1)
    return "Tell us your name and how to reach you so we can find or create your visitor record.";
  if (step === 2) return "A few more details about your visit.";
  if (step === 3)
    return kycAvailable
      ? "Please review your details, then choose how to verify your ID."
      : "Please review and submit.";
  if (step === 4 && kycAvailable)
    return "Verify your identity instantly with Dojah, or skip and a receptionist will verify you manually.";
  return "";
}

// ── Step 1: Identity ────────────────────────────────────────────────

function IdentityStep({
  state,
  setState,
  onNext,
  error,
}: {
  state: KioskState;
  setState: React.Dispatch<React.SetStateAction<KioskState>>;
  onNext: () => void;
  error: string | null;
}) {
  const [emailTouched, setEmailTouched] = useState(false);
  const emailTrimmed = state.email.trim();
  const showEmailFormatError =
    emailTouched && emailTrimmed.length > 0 && !isValidEmail(emailTrimmed);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="kiosk-name" className="text-sm">
          Full name
          <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
        </Label>
        <Input
          id="kiosk-name"
          type="text"
          autoComplete="name"
          value={state.fullName}
          onChange={(e) => setState((s) => ({ ...s, fullName: e.target.value }))}
          className="text-base md:text-sm min-h-[44px]"
          placeholder="Jane Doe"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kiosk-phone" className="text-sm">
          Phone
          <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
        </Label>
        <PhoneInput
          id="kiosk-phone"
          value={state.phone}
          onChange={(v) => setState((s) => ({ ...s, phone: v }))}
          placeholder="Phone number"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kiosk-email" className="text-sm">
          Email <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="kiosk-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
          onBlur={() => setEmailTouched(true)}
          aria-invalid={showEmailFormatError || undefined}
          aria-describedby={
            showEmailFormatError ? "kiosk-email-error" : undefined
          }
          className={cn(
            "text-base md:text-sm min-h-[44px]",
            showEmailFormatError &&
              "border-destructive focus-visible:ring-destructive",
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
            <Button onClick={onNext}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Continue to the next step
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Step 4: KYC option (final step) ─────────────────────────────────

function KycOptionStep({
  intent,
  onChoose,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  intent: KycIntent | null;
  onChoose: (intent: KycIntent) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Verifying your ID with Dojah lets the receptionist approve you faster.
        You can also skip and have your identity confirmed manually. Choose an
        option, then submit — if you pick Dojah, the verification widget opens
        right after you submit.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={intent === "verify" ? "default" : "outline"}
              onClick={() => onChoose("verify")}
              className={cn(
                "min-h-[88px] flex-col gap-2",
                intent === "verify" && "ring-2 ring-primary",
              )}
              aria-pressed={intent === "verify"}
            >
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              Verify with Dojah
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Open the Dojah widget after submitting to verify your ID
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={intent === "skip" ? "default" : "outline"}
              onClick={() => onChoose("skip")}
              className={cn(
                "min-h-[88px] flex-col gap-2",
                intent === "skip" && "ring-2 ring-primary",
              )}
              aria-pressed={intent === "skip"}
            >
              <ClipboardList className="h-6 w-6" aria-hidden="true" />
              Skip for now
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Send your check-in without verifying — a receptionist will verify
            you manually
          </TooltipContent>
        </Tooltip>
      </div>

      {intent && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border bg-muted/40 p-3 text-sm flex items-start gap-2"
        >
          {intent === "verify" ? (
            <>
              <ShieldCheck
                className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>
                Got it. We&apos;ll open the Dojah verification widget right
                after you submit.
              </span>
            </>
          ) : (
            <>
              <ClipboardList
                className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                Got it. A receptionist will verify your identity manually
                after you submit.
              </span>
            </>
          )}
        </div>
      )}

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
            <Button variant="outline" onClick={onBack} disabled={submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Return to review your details</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <LoadingButton
                onClick={onSubmit}
                isLoading={submitting}
                loadingText="Submitting…"
                disabled={!intent || submitting}
              >
                Submit check-in
              </LoadingButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {intent
              ? "Send your check-in to the receptionist for approval"
              : "Pick verify or skip first"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Step 2: Details ─────────────────────────────────────────────────

function DetailsStep({
  fields,
  enums,
  fieldValues,
  setFieldValue,
  onBack,
  onNext,
  error,
}: {
  fields: RequiredField[];
  enums: ReturnType<typeof useCheckinEnumsForTenant>["data"];
  fieldValues: Record<string, unknown>;
  setFieldValue: (key: string, value: unknown) => void;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      {fields.length > 0 && (
        <RequiredFieldsForm
          fields={fields}
          values={fieldValues}
          onChange={setFieldValue}
          enums={enums}
        />
      )}

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
          <TooltipContent side="top">Return to the previous step</TooltipContent>
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

// ── Step 3: Review ──────────────────────────────────────────────────

function ReviewStep({
  state,
  fields,
  enums,
  kycAvailable,
  onBack,
  onContinue,
  onSubmit,
  submitting,
  error,
}: {
  state: KioskState;
  fields: RequiredField[];
  enums: ReturnType<typeof useCheckinEnumsForTenant>["data"];
  /**
   * When true a final Verify step follows, so Review advances to it
   * (`onContinue`) instead of submitting. When false Review is the last
   * step and submits directly (`onSubmit`).
   */
  kycAvailable: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <dl className="space-y-2 text-sm">
        <ReviewItem label="Name" value={state.fullName} />
        <ReviewItem label="Phone" value={state.phone} />
        {state.email && <ReviewItem label="Email" value={state.email} />}
        {fields.map((f) => {
          const v = state.fieldValues[f.key];
          if (v == null || v === "") return null;
          return (
            <ReviewItem
              key={f.key}
              label={f.label}
              value={renderReviewValue(f, v, enums)}
            />
          );
        })}
      </dl>

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        {kycAvailable
          ? "Next you'll choose how to verify your ID, then submit. Your check-in is sent for receptionist approval."
          : "Your check-in will be sent for receptionist approval."}
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
            <Button variant="outline" onClick={onBack} disabled={submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Make edits before submitting</TooltipContent>
        </Tooltip>
        {kycAvailable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onContinue}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Continue to choose how to verify your ID
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  onClick={onSubmit}
                  isLoading={submitting}
                  loadingText="Submitting…"
                >
                  Submit check-in
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Send your check-in to the receptionist for approval
            </TooltipContent>
          </Tooltip>
        )}
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

/**
 * Resolve enum picker values back to their human label for the review
 * panel — `"meeting"` → `"Meeting"`. Falls back to the raw value when the
 * field isn't enum-driven or the option isn't found (custom values).
 */
function renderReviewValue(
  field: RequiredField,
  value: unknown,
  enums: ReturnType<typeof useCheckinEnumsForTenant>["data"],
): string {
  const raw = String(value ?? "");
  if (!field.enumKind || !enums) return raw;
  const bundle = enums.enums[field.enumKind];
  const match = bundle?.options.find((o) => o.value === raw);
  return match?.label ?? raw;
}

// ── Step 5: Post-submit ─────────────────────────────────────────────

function PostSubmitScreen({
  phase,
  tenantName,
  onKycEvent,
  onRetry,
  retrying,
  fullName,
  email,
}: {
  phase: KycPhase;
  tenantName: string;
  onKycEvent: (type: string) => void;
  onRetry: () => void;
  retrying: boolean;
  fullName: string;
  email: string;
}) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const userData = useMemo(
    () => ({
      first_name: first || undefined,
      last_name: rest.join(" ") || undefined,
      email: email.trim() || undefined,
    }),
    [first, rest, email],
  );

  if (phase.kind === "kyc_running") {
    return (
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <KycWidget
            widgetConfig={phase.widgetConfig}
            userData={userData}
            onEvent={onKycEvent}
          />
        </CardContent>
      </Card>
    );
  }

  const screenState = mapPhaseToScreenState(phase);
  const note =
    phase.kind === "awaiting_approval" && phase.kycSilentlySkipped
      ? "Verification wasn't available right now, so we skipped it. The receptionist will verify your identity manually when they approve your check-in."
      : undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        <KycStatusScreen
          state={screenState}
          tenantName={tenantName}
          message={
            phase.kind === "kyc_failed" ? phase.reason : undefined
          }
          note={note}
          onRetry={phase.kind === "kyc_failed" ? onRetry : undefined}
          retrying={retrying}
        />
      </CardContent>
    </Card>
  );
}

function mapPhaseToScreenState(phase: KycPhase): KycStatusScreenState {
  switch (phase.kind) {
    case "awaiting_approval":
      return "awaiting_approval";
    case "kyc_failed":
      return "failed";
    case "kyc_initiating":
    case "kyc_polling":
    case "kyc_verifying":
    case "kyc_skipping":
    default:
      return "verifying";
  }
}
