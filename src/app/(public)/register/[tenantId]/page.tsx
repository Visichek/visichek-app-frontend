"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Loader2,
  ScanLine,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ShieldCheck,
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
import { ErrorState } from "@/components/feedback/error-state";
import { PrivacyNoticeDisplay } from "@/features/public-registration/components/privacy-notice-display";
import { RegistrationSuccess } from "@/features/public-registration/components/registration-success";
import {
  usePublicTenantInfo,
  usePublicDepartments,
  usePublicPrivacyNotice,
  useAppointmentPrefill,
  usePublicRegister,
  useVerifyRegistrationToken,
  usePublicOcrIdScan,
  usePublicLookup,
  usePublicFinalize,
} from "@/features/public-registration/hooks";
import type {
  PublicRegistrationRequest,
  PublicLookupResponse,
} from "@/types/public";
import { ApiError } from "@/types/api";

const OCR_CONFIDENCE_THRESHOLD = 0.7;

function buildRegistrationSchema(
  consentRequired: boolean,
  nameRequired: boolean
) {
  return z.object({
    fullName: nameRequired
      ? z.string().min(1, "Full name is required")
      : z.string().optional(),
    phone: z.string().min(1, "Phone number is required"),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    company: z.string().optional(),
    departmentId: z.string().min(1, "Department is required"),
    purpose: z.string().optional(),
    consentGranted: consentRequired
      ? z.literal(true, {
          errorMap: () => ({
            message: "You must consent to the privacy notice to register.",
          }),
        })
      : z.boolean().optional(),
  });
}

type RegistrationFormValues = z.infer<
  ReturnType<typeof buildRegistrationSchema>
>;

export default function PublicRegistrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.tenantId as string;
  const appointmentId = searchParams.get("appointment");
  const registrationToken = searchParams.get("token");

  // ── Queries / mutations ────────────────────────────────────────────
  const tenantQ = usePublicTenantInfo(tenantId);
  const deptsQ = usePublicDepartments(tenantId);
  const noticeQ = usePublicPrivacyNotice(tenantId);
  const apptQ = useAppointmentPrefill(tenantId, appointmentId);
  const tokenQ = useVerifyRegistrationToken(registrationToken);

  const registerMutation = usePublicRegister(tenantId);
  const ocrMutation = usePublicOcrIdScan(tenantId);
  const lookupMutation = usePublicLookup(tenantId);
  const finalizeMutation = usePublicFinalize(tenantId);

  // ── State ──────────────────────────────────────────────────────────
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [registeredCompany, setRegisteredCompany] = useState<string | undefined>();
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [profileMatch, setProfileMatch] = useState<PublicLookupResponse | null>(
    null
  );
  const [lookupPhone, setLookupPhone] = useState("");
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);
  const [receptionistCode, setReceptionistCode] = useState("");
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const consentRequired = noticeQ.data?.displayMode === "active_consent";
  const nameRequired = !profileMatch?.profileId;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(
      buildRegistrationSchema(consentRequired ?? false, nameRequired)
    ),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      company: "",
      departmentId: "",
      purpose: "",
      consentGranted: false,
    },
  });

  // Appointment prefill
  useEffect(() => {
    const data = apptQ.data;
    if (!data) return;
    if (data.visitorName) setValue("fullName", data.visitorName);
    if (data.departmentId) setValue("departmentId", data.departmentId);
    if (data.purpose) setValue("purpose", data.purpose);
  }, [apptQ.data, setValue]);

  // Token-scoped department lock
  useEffect(() => {
    const scope = tokenQ.data;
    if (scope?.valid && scope.departmentId) {
      setValue("departmentId", scope.departmentId);
    }
  }, [tokenQ.data, setValue]);

  // Apply tenant branding
  useEffect(() => {
    if (tenantQ.data?.primaryColor) {
      document.documentElement.style.setProperty(
        "--tenant-primary",
        tenantQ.data.primaryColor
      );
    }
    return () => {
      document.documentElement.style.removeProperty("--tenant-primary");
    };
  }, [tenantQ.data]);

  // ── Returning visitor lookup ──────────────────────────────────────
  async function runLookup() {
    const phone = lookupPhone.trim();
    if (phone.length < 4) {
      setSubmitError("Enter your phone number to look up a returning visit.");
      return;
    }
    setSubmitError(null);
    try {
      const result = await lookupMutation.mutateAsync({ phone });
      if (result.found) {
        setProfileMatch(result);
        setValue("phone", phone);
        if (result.company) setValue("company", result.company);
      } else {
        setProfileMatch(null);
        setValue("phone", phone);
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Lookup failed. You can still register below."
      );
    }
  }

  function clearProfileMatch() {
    setProfileMatch(null);
  }

  // ── OCR ID scan ───────────────────────────────────────────────────
  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrNotice(null);
    try {
      const result = await ocrMutation.mutateAsync(file);
      if (result.confidence < OCR_CONFIDENCE_THRESHOLD) {
        setOcrNotice(
          `Low confidence scan (${Math.round(
            result.confidence * 100
          )}%). Please verify the fields below or rescan.`
        );
      } else {
        setOcrNotice(
          `Scanned successfully (${Math.round(result.confidence * 100)}%). Please confirm the details.`
        );
      }
      if (result.fullName) setValue("fullName", result.fullName);
    } catch (err) {
      setOcrNotice(
        err instanceof ApiError
          ? err.message
          : "Couldn't read the ID. Try a clearer photo or fill the form manually."
      );
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────
  async function onSubmit(values: RegistrationFormValues) {
    setSubmitError(null);

    const payload: PublicRegistrationRequest = {
      phone: values.phone,
      departmentId: values.departmentId,
      fullName: values.fullName || undefined,
      email: values.email || undefined,
      company: values.company || undefined,
      purpose: values.purpose || undefined,
      consentGranted: values.consentGranted || undefined,
      appointmentId: appointmentId || undefined,
    };

    if (profileMatch?.profileId) {
      payload.profileId = profileMatch.profileId;
    }
    if (registrationToken && tokenQ.data?.valid) {
      payload.registrationToken = registrationToken;
    }
    if (noticeQ.data && values.consentGranted) {
      payload.consentMethod = "public_registration_form";
      payload.privacyNoticeVersionId =
        noticeQ.data.versionId || noticeQ.data.id;
    }
    if (apptQ.data?.hostId) {
      payload.hostId = apptQ.data.hostId;
    }

    try {
      const response = await registerMutation.mutateAsync(payload);
      setRegisteredName(
        values.fullName || profileMatch?.fullNameMasked || "Visitor"
      );
      setRegisteredCompany(values.company || profileMatch?.company || undefined);
      setCreatedSessionId(response.session?.id ?? null);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Registration failed. Please try again."
      );
    }
  }

  async function onFinalize(e: React.FormEvent) {
    e.preventDefault();
    setFinalizeError(null);
    if (!createdSessionId) return;
    const code = receptionistCode.trim();
    if (!code) {
      setFinalizeError("Enter the receptionist code to finalize your check-in.");
      return;
    }
    try {
      await finalizeMutation.mutateAsync({
        sessionId: createdSessionId,
        receptionistCode: code,
      });
      setCreatedSessionId(null);
    } catch (err) {
      setFinalizeError(
        err instanceof ApiError
          ? err.message
          : "Couldn't finalize. Check the code and try again."
      );
    }
  }

  // ── Loading / error gates ──────────────────────────────────────────
  const isInitialLoading =
    tenantQ.isLoading ||
    deptsQ.isLoading ||
    noticeQ.isLoading ||
    (!!registrationToken && tokenQ.isLoading);

  if (isInitialLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading registration form...
          </p>
        </div>
      </div>
    );
  }

  if (tenantQ.error || !tenantQ.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <ErrorState
          title="Organisation not found"
          message="This registration link may be invalid or the organisation is no longer accepting visitors."
          onRetry={() => tenantQ.refetch()}
        />
      </div>
    );
  }

  // Expired / tampered registration token
  if (registrationToken && tokenQ.data && !tokenQ.data.valid) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <ErrorState
          title="Link expired"
          message="This registration QR link has expired or is invalid. Please ask reception for a new QR code."
        />
      </div>
    );
  }

  if (deptsQ.error || !deptsQ.data || deptsQ.data.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <ErrorState
          title="Registration unavailable"
          message="No departments are configured for visitor registration at this organisation."
        />
      </div>
    );
  }

  // ── Post-register: receptionist code finalize step ────────────────
  if (createdSessionId) {
    return (
      <div className="flex flex-col items-center px-4 py-8 md:py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <CardTitle>Almost done</CardTitle>
            <CardDescription>
              Show this screen to the receptionist and enter the code they give
              you to finalize your check-in and print your badge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onFinalize} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receptionistCode">Receptionist code</Label>
                <Input
                  id="receptionistCode"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="e.g. 65f…"
                  value={receptionistCode}
                  onChange={(e) => setReceptionistCode(e.target.value)}
                  className="text-base md:text-sm"
                />
              </div>
              {finalizeError && (
                <p className="text-sm text-destructive" role="alert">
                  {finalizeError}
                </p>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <LoadingButton
                    type="submit"
                    isLoading={finalizeMutation.isPending}
                    loadingText="Finalizing..."
                    className="w-full"
                  >
                    Finalize check-in
                  </LoadingButton>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Confirm your registration using the receptionist&apos;s code
                  to issue your badge
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setCreatedSessionId(null);
                    }}
                  >
                    Skip — I&apos;ll wait at reception
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Leave finalization to the receptionist. Your entry is already
                  registered.
                </TooltipContent>
              </Tooltip>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Final success state (after finalize skipped/done) ─────────────
  if (registeredName) {
    return (
      <RegistrationSuccess
        visitorName={registeredName}
        companyName={registeredCompany ?? tenantQ.data.companyName}
      />
    );
  }

  const showAppointmentBanner =
    appointmentId && apptQ.data && !apptQ.isLoading;
  const deptLocked = !!tokenQ.data?.valid && !!tokenQ.data.departmentId;
  const fastPath = !!profileMatch?.profileId;
  const skipIdScan = fastPath && profileMatch?.idVerifiedRecently;

  return (
    <div className="flex flex-col items-center px-4 py-8 md:py-12">
      {/* Tenant branding header */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        {tenantQ.data.logoUrl ? (
          <img
            src={tenantQ.data.logoUrl}
            alt={`${tenantQ.data.companyName} logo`}
            className="h-12 w-auto object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" aria-hidden />
          </div>
        )}
        <h1 className="text-2xl font-display font-semibold">
          {tenantQ.data.companyName}
        </h1>
        <p className="text-sm text-muted-foreground">Visitor Registration</p>
      </div>

      {/* Token scope banner */}
      {tokenQ.data?.valid && (
        <div className="mb-4 w-full max-w-lg rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-foreground/90">
            Registering via secure QR link. Department is pre-selected for you.
          </p>
        </div>
      )}

      {showAppointmentBanner && (
        <div className="mb-4 w-full max-w-lg rounded-md border border-info/30 bg-info/5 p-3 text-center text-sm">
          <p className="font-medium text-foreground">
            Appointment with {apptQ.data?.hostName || "your host"}
          </p>
          {apptQ.data?.scheduledDatetime && (
            <p className="text-muted-foreground">
              Scheduled:{" "}
              {new Date(
                apptQ.data.scheduledDatetime * 1000
              ).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Returning visitor lookup */}
      {!profileMatch && (
        <div className="mb-4 w-full max-w-lg rounded-md border border-dashed border-border bg-muted/30 p-3 space-y-2">
          <Label
            htmlFor="lookupPhone"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            Been here before? Skip the form
          </Label>
          <div className="flex gap-2">
            <Input
              id="lookupPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Your phone number"
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              className="flex-1 text-base md:text-sm"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runLookup}
                  disabled={lookupMutation.isPending}
                >
                  {lookupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Look up"
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Check if you&apos;ve visited before so we can skip most of the
                form
              </TooltipContent>
            </Tooltip>
          </div>
          {lookupMutation.isSuccess && !profileMatch && (
            <p className="text-xs text-muted-foreground">
              No previous visit found for that number. Continue with the form
              below.
            </p>
          )}
        </div>
      )}

      {profileMatch && (
        <div className="mb-4 w-full max-w-lg rounded-md border border-primary/40 bg-primary/5 p-3 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">
                Welcome back, {profileMatch.fullNameMasked}
              </p>
              <p className="text-xs text-muted-foreground">
                {profileMatch.lastVisitAgoDays != null
                  ? `Last visit ${profileMatch.lastVisitAgoDays} day${profileMatch.lastVisitAgoDays === 1 ? "" : "s"} ago`
                  : "Previous visit on file"}
                {profileMatch.idVerifiedRecently
                  ? " · ID already verified"
                  : " · ID verification required"}
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearProfileMatch}
              >
                Not me
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Clear the match and register as a new visitor
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Privacy notice */}
      {noticeQ.data && (
        <div className="mb-6 w-full max-w-lg">
          <PrivacyNoticeDisplay notice={noticeQ.data} />
        </div>
      )}

      {/* Registration form */}
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">
            {fastPath ? "Confirm your visit" : "Your Details"}
          </CardTitle>
          <CardDescription>
            {fastPath
              ? "We've prefilled what we have on file. Just pick a department and purpose."
              : "Please fill in your information to register your visit."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitError && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {submitError}
              </div>
            )}

            {/* ID scan option — only for new/unverified visitors */}
            {!skipIdScan && (
              <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Scan your ID</p>
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll read your name from the ID — faster than typing
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={ocrMutation.isPending}
                      >
                        {ocrMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Scanning…
                          </>
                        ) : (
                          <>
                            <ScanLine className="h-4 w-4 mr-2" />
                            Scan ID
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Upload or capture a photo of your ID to prefill the form
                    </TooltipContent>
                  </Tooltip>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onFileChosen}
                  aria-label="Upload ID image"
                />
                {ocrNotice && (
                  <p
                    className={`text-xs flex items-start gap-1 ${
                      ocrMutation.isError
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {ocrMutation.isError ? (
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    )}
                    <span>{ocrNotice}</span>
                  </p>
                )}
              </div>
            )}

            {/* Full name — hidden when returning */}
            {!fastPath && (
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  autoComplete="name"
                  autoFocus
                  className="text-base md:text-sm"
                  {...register("fullName")}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">
                    {errors.fullName.message}
                  </p>
                )}
              </div>
            )}

            {/* Phone — always visible (locked when returning) */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="+234 800 000 0000"
                autoComplete="tel"
                readOnly={fastPath}
                className="text-base md:text-sm"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {!fastPath && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="text-base md:text-sm"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    type="text"
                    placeholder="Your company name"
                    autoComplete="organization"
                    className="text-base md:text-sm"
                    {...register("company")}
                  />
                </div>
              </>
            )}

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="departmentId">
                Department <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={deptLocked}
                  >
                    <SelectTrigger
                      id="departmentId"
                      className="text-base md:text-sm"
                    >
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {deptsQ.data?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId && (
                <p className="text-sm text-destructive">
                  {errors.departmentId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose of Visit</Label>
              <Textarea
                id="purpose"
                placeholder="Brief description of your visit"
                rows={2}
                className="text-base md:text-sm resize-none"
                {...register("purpose")}
              />
            </div>

            {consentRequired && (
              <div className="space-y-2">
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Controller
                    name="consentGranted"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="consentGranted"
                        checked={field.value === true}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                        aria-describedby="consent-error"
                      />
                    )}
                  />
                  <Label
                    htmlFor="consentGranted"
                    className="text-sm font-normal leading-relaxed cursor-pointer"
                  >
                    I have read the privacy notice and consent to the processing
                    of my personal data for the purpose of this visit.
                  </Label>
                </div>
                {errors.consentGranted && (
                  <p
                    id="consent-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.consentGranted.message}
                  </p>
                )}
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting || registerMutation.isPending}
                  loadingText="Registering..."
                  className="w-full"
                >
                  Register Visit
                </LoadingButton>
              </TooltipTrigger>
              <TooltipContent side="top">
                Submit your details and get a receptionist-code step to finalize
                your check-in
              </TooltipContent>
            </Tooltip>

            {consentRequired && (
              <p className="text-center text-xs text-muted-foreground">
                Consent is required to complete registration.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
