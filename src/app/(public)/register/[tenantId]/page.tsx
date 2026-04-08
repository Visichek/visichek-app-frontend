"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/features/public-registration/hooks";
import type { PublicRegistrationRequest } from "@/types/public";
import { ApiError } from "@/types/api";

// ── Form Schema ──────────────────────────────────────────────────────

function buildRegistrationSchema(consentRequired: boolean) {
  return z.object({
    fullName: z.string().min(1, "Full name is required"),
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

type RegistrationFormValues = z.infer<ReturnType<typeof buildRegistrationSchema>>;

// ── Page Component ───────────────────────────────────────────────────

export default function PublicRegistrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.tenantId as string;
  const appointmentId = searchParams.get("appointment");

  // ── Data queries ──────────────────────────────────────────────────
  const {
    data: tenantInfo,
    isLoading: tenantLoading,
    error: tenantError,
    refetch: refetchTenant,
  } = usePublicTenantInfo(tenantId);

  const {
    data: departments,
    isLoading: deptsLoading,
    error: deptsError,
  } = usePublicDepartments(tenantId);

  const {
    data: privacyNotice,
    isLoading: noticeLoading,
  } = usePublicPrivacyNotice(tenantId);

  const {
    data: appointmentData,
    isLoading: appointmentLoading,
  } = useAppointmentPrefill(tenantId, appointmentId);

  // ── Registration mutation ─────────────────────────────────────────
  const registerMutation = usePublicRegister(tenantId);

  // ── Local state ───────────────────────────────────────────────────
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [registeredCompany, setRegisteredCompany] = useState<string | undefined>();

  // ── Consent required check ──────────────────────────────────────────
  const consentRequired = privacyNotice?.displayMode === "active_consent";

  // ── Form ──────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(buildRegistrationSchema(consentRequired ?? false)),
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

  // ── Appointment prefill effect ────────────────────────────────────
  useEffect(() => {
    if (appointmentData) {
      if (appointmentData.visitorName) {
        setValue("fullName", appointmentData.visitorName);
      }
      if (appointmentData.departmentId) {
        setValue("departmentId", appointmentData.departmentId);
      }
      if (appointmentData.purpose) {
        setValue("purpose", appointmentData.purpose);
      }
    }
  }, [appointmentData, setValue]);

  // ── Apply tenant branding ─────────────────────────────────────────
  useEffect(() => {
    if (tenantInfo?.primaryColor) {
      document.documentElement.style.setProperty(
        "--tenant-primary",
        tenantInfo.primaryColor
      );
    }
    return () => {
      document.documentElement.style.removeProperty("--tenant-primary");
    };
  }, [tenantInfo]);

  // ── Submit handler ────────────────────────────────────────────────
  async function onSubmit(values: RegistrationFormValues) {
    setSubmitError(null);

    // Build request payload
    const payload: PublicRegistrationRequest = {
      fullName: values.fullName,
      phone: values.phone,
      departmentId: values.departmentId,
      email: values.email || undefined,
      company: values.company || undefined,
      purpose: values.purpose || undefined,
      consentGranted: values.consentGranted || undefined,
      appointmentId: appointmentId || undefined,
    };

    // Attach consent metadata if privacy notice was shown
    if (privacyNotice && values.consentGranted) {
      payload.consentMethod = "public_registration_form";
      payload.privacyNotice_versionId = privacyNotice.versionId || privacyNotice.id;
    }

    // Attach host from appointment prefill if present
    if (appointmentData?.hostId) {
      payload.hostId = appointmentData.hostId;
    }

    try {
      await registerMutation.mutateAsync(payload);
      setRegisteredName(values.fullName);
      setRegisteredCompany(values.company || undefined);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Registration failed. Please try again.");
      }
    }
  }

  // ── Loading state ─────────────────────────────────────────────────
  const isInitialLoading = tenantLoading || deptsLoading || noticeLoading;

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

  // ── Tenant error / not found ──────────────────────────────────────
  if (tenantError || !tenantInfo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <ErrorState
          title="Organisation not found"
          message="This registration link may be invalid or the organisation is no longer accepting visitors."
          onRetry={() => refetchTenant()}
        />
      </div>
    );
  }

  // ── Departments error / empty ─────────────────────────────────────
  if (deptsError || !departments || departments.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <ErrorState
          title="Registration unavailable"
          message="No departments are configured for visitor registration at this organisation."
        />
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────
  if (registeredName) {
    return (
      <RegistrationSuccess
        visitorName={registeredName}
        companyName={registeredCompany ?? tenantInfo.companyName}
      />
    );
  }

  // ── Appointment banner ────────────────────────────────────────────
  const showAppointmentBanner =
    appointmentId && appointmentData && !appointmentLoading;

  return (
    <div className="flex flex-col items-center px-4 py-8 md:py-12">
      {/* Tenant branding header */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        {tenantInfo.logoUrl ? (
          <img
            src={tenantInfo.logoUrl}
            alt={`${tenantInfo.companyName} logo`}
            className="h-12 w-auto object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
        )}
        <h1 className="text-2xl font-display font-semibold">
          {tenantInfo.companyName}
        </h1>
        <p className="text-sm text-muted-foreground">Visitor Registration</p>
      </div>

      {/* Appointment prefill banner */}
      {showAppointmentBanner && (
        <div className="mb-4 w-full max-w-lg rounded-md border border-info/30 bg-info/5 p-3 text-center text-sm">
          <p className="font-medium text-foreground">
            Appointment with{" "}
            {appointmentData.hostName || "your host"}
          </p>
          {appointmentData.scheduledDatetime && (
            <p className="text-muted-foreground">
              Scheduled:{" "}
              {new Date(
                appointmentData.scheduledDatetime * 1000
              ).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Privacy notice */}
      {privacyNotice && (
        <div className="mb-6 w-full max-w-lg">
          <PrivacyNoticeDisplay notice={privacyNotice} />
        </div>
      )}

      {/* Registration form */}
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">Your Details</CardTitle>
          <CardDescription>
            Please fill in your information to register your visit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Submit error */}
            {submitError && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {submitError}
              </div>
            )}

            {/* Full Name */}
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

            {/* Phone */}
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
                className="text-base md:text-sm"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Email */}
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

            {/* Company */}
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
                  >
                    <SelectTrigger id="departmentId" className="text-base md:text-sm">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
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

            {/* Purpose */}
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

            {/* Consent checkbox (conditional) */}
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

            {/* Submit */}
            <LoadingButton
              type="submit"
              isLoading={isSubmitting || registerMutation.isPending}
              loadingText="Registering..."
              className="w-full"
              disabled={consentRequired ? false : undefined}
            >
              Register Visit
            </LoadingButton>

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
