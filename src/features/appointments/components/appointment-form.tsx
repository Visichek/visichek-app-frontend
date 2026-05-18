"use client";

import Image from "next/image";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { FileUploadZone } from "@/components/recipes/file-upload-zone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useAppointmentFormRequirements,
  useCreateAppointment,
  useUpdateAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { ApiError } from "@/types/api";
import type {
  Appointment,
  AppointmentFormFieldRequirement,
} from "@/types/visitor";

const appointmentSchema = z.object({
  visitorNameSnapshot: z.string().trim().min(1, "Visitor name is required"),
  visitorPhoneSnapshot: z
    .string()
    .trim()
    .min(1, "Visitor phone number is required")
    .regex(
      /^\+?[0-9\s\-()]{7,}$/,
      "Enter a valid phone number (digits, spaces, +, -, ( ) only)",
    ),
  hostNameSnapshot: z.string().trim().min(1, "Host name is required"),
  departmentId: z.string().trim().min(1, "Department is required"),
  scheduledDatetime: z.string().min(1, "Date and time is required"),
  purpose: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  /** When set, the form is in edit mode. */
  appointment?: Appointment;
}

function formatTimestampToDatetime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function AppointmentForm({ appointment }: AppointmentFormProps) {
  const { loadingHref, navigate } = useNavigationLoading();
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const departmentsQuery = useDepartments();
  const formRequirementsQuery = useAppointmentFormRequirements();
  const isEditing = !!appointment;

  // Expected-visitor photo: tracked outside react-hook-form because the
  // upload runs to completion (returning an objectKey) before submit.
  // Initial value comes from the existing appointment in edit mode; the
  // signed URL is used purely for the preview thumbnail.
  const [photoObjectKey, setPhotoObjectKey] = useState<string | null>(
    appointment?.expectedVisitorPhotoObjectKey ?? null,
  );
  const initialPhotoUrl = appointment?.expectedVisitorPhotoUrl ?? null;

  // tenant_form_data is held outside react-hook-form so the dynamic
  // field set can grow / shrink without re-registering schemas. The
  // form-requirements endpoint owns the contract.
  const [tenantFormData, setTenantFormData] = useState<Record<string, unknown>>(
    () => ({ ...(appointment?.tenantFormData ?? {}) }),
  );
  const [tenantFieldErrors, setTenantFieldErrors] = useState<
    Record<string, string>
  >({});

  const tenantRequiredFields =
    formRequirementsQuery.data?.tenantRequiredFields ?? [];

  function setTenantFieldValue(key: string, value: unknown) {
    setTenantFormData((prev) => ({ ...prev, [key]: value }));
    if (tenantFieldErrors[key]) {
      setTenantFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function buildTenantFormDataPayload(): Record<string, unknown> | undefined {
    // Drop empty / unset entries — the backend treats missing keys the
    // same as null and we want a clean diff for the PATCH audit.
    const clean: Record<string, unknown> = {};
    for (const field of tenantRequiredFields) {
      const value = tenantFormData[field.key];
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        continue;
      }
      clean[field.key] = value;
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
  }

  function validateTenantRequiredFields(): boolean {
    const next: Record<string, string> = {};
    for (const field of tenantRequiredFields) {
      if (!field.required) continue;
      const value = tenantFormData[field.key];
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        next[field.key] = `${field.label || field.key} is required`;
      }
    }
    setTenantFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      visitorNameSnapshot: appointment?.visitorNameSnapshot ?? "",
      visitorPhoneSnapshot: appointment?.visitorPhoneSnapshot ?? "",
      hostNameSnapshot: appointment?.hostNameSnapshot ?? "",
      departmentId: appointment?.departmentId ?? "",
      scheduledDatetime: appointment
        ? formatTimestampToDatetime(appointment.scheduledDatetime)
        : "",
      purpose: appointment?.purpose ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    if (!validateTenantRequiredFields()) {
      toast.error("Fill every required tenant field before submitting.");
      return;
    }

    const scheduledDatetime = Math.floor(
      new Date(data.scheduledDatetime).getTime() / 1000,
    );
    const tenantFormDataPayload = buildTenantFormDataPayload();

    try {
      if (isEditing && appointment) {
        await updateMutation.mutateAsync({
          appointmentId: appointment.id,
          data: {
            visitorNameSnapshot: data.visitorNameSnapshot,
            visitorPhoneSnapshot: data.visitorPhoneSnapshot,
            hostNameSnapshot: data.hostNameSnapshot,
            departmentId: data.departmentId,
            scheduledDatetime,
            purpose: data.purpose,
            // Send `null` to clear the photo, the object key to set/keep it.
            expectedVisitorPhotoObjectKey: photoObjectKey,
            ...(tenantFormDataPayload
              ? { tenantFormData: tenantFormDataPayload }
              : {}),
          },
        });
        toast.success("Appointment updated");
      } else {
        await createMutation.mutateAsync({
          visitorNameSnapshot: data.visitorNameSnapshot,
          visitorPhoneSnapshot: data.visitorPhoneSnapshot,
          hostNameSnapshot: data.hostNameSnapshot,
          departmentId: data.departmentId,
          hostId: "", // Backend assigns if empty
          scheduledDatetime,
          purpose: data.purpose,
          tenantId: "", // Backend fills from session
          ...(photoObjectKey
            ? { expectedVisitorPhotoObjectKey: photoObjectKey }
            : {}),
          ...(tenantFormDataPayload
            ? { tenantFormData: tenantFormDataPayload }
            : {}),
        });
        toast.success("Appointment created");
      }
      navigate("/app/appointments");
    } catch (err) {
      // 400 VALIDATION_FAILED with details.missing_fields = [...] →
      // map each missing field_id back to its inline error.
      if (err instanceof ApiError && err.status === 400) {
        const details = err.details;
        const missing =
          details && typeof details === "object"
            ? (details as { missing_fields?: unknown; missingFields?: unknown })
            : undefined;
        const rawList =
          (missing?.missing_fields as unknown) ??
          (missing?.missingFields as unknown);
        if (Array.isArray(rawList) && rawList.length > 0) {
          const next: Record<string, string> = {};
          for (const key of rawList) {
            if (typeof key !== "string") continue;
            const field = tenantRequiredFields.find((f) => f.key === key);
            next[key] = `${field?.label || key} is required`;
          }
          setTenantFieldErrors(next);
          toast.error("Some required fields are missing.");
          return;
        }
      }
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} appointment`,
      );
    }
  });

  const submitting =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href="/app/appointments" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/app/appointments" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to appointments
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the appointments list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit appointment" : "New appointment"}
        description={
          isEditing
            ? "Update this appointment's details."
            : "Schedule a future appointment for a visitor with a host."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="visitorNameSnapshot">Visitor name *</Label>
          <Input
            id="visitorNameSnapshot"
            placeholder="Full name of visitor"
            {...register("visitorNameSnapshot")}
            aria-invalid={!!errors.visitorNameSnapshot}
            aria-describedby={
              errors.visitorNameSnapshot
                ? "error-visitorNameSnapshot"
                : undefined
            }
            className="min-h-[44px]"
          />
          {errors.visitorNameSnapshot && (
            <p
              id="error-visitorNameSnapshot"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.visitorNameSnapshot.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="visitorPhoneSnapshot">Visitor phone number *</Label>
          <Input
            id="visitorPhoneSnapshot"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. +234 801 234 5678"
            {...register("visitorPhoneSnapshot")}
            aria-invalid={!!errors.visitorPhoneSnapshot}
            aria-describedby={
              errors.visitorPhoneSnapshot
                ? "error-visitorPhoneSnapshot"
                : "help-visitorPhoneSnapshot"
            }
            className="min-h-[44px]"
          />
          {errors.visitorPhoneSnapshot ? (
            <p
              id="error-visitorPhoneSnapshot"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.visitorPhoneSnapshot.message}
            </p>
          ) : (
            <p
              id="help-visitorPhoneSnapshot"
              className="text-xs text-muted-foreground"
            >
              Used to look up the visitor at check-in. Avoids prompting for it
              again at the reception desk.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="hostNameSnapshot">Host name *</Label>
          <Input
            id="hostNameSnapshot"
            placeholder="Name of host or employee"
            {...register("hostNameSnapshot")}
            aria-invalid={!!errors.hostNameSnapshot}
            aria-describedby={
              errors.hostNameSnapshot ? "error-hostNameSnapshot" : undefined
            }
            className="min-h-[44px]"
          />
          {errors.hostNameSnapshot && (
            <p
              id="error-hostNameSnapshot"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.hostNameSnapshot.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="departmentId">Department *</Label>
          <Controller
            name="departmentId"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                id="departmentId"
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Select a department"
                searchPlaceholder="Search departments..."
                emptyText="No departments match your search"
                triggerClassName="min-h-[44px]"
                options={
                  departmentsQuery.data?.items
                    ?.filter((dept) => !!dept?.id)
                    .map((dept) => ({ value: dept.id, label: dept.name })) ?? []
                }
              />
            )}
          />
          {errors.departmentId && (
            <p className="text-sm text-destructive" role="alert">
              {errors.departmentId.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scheduledDatetime">Scheduled date &amp; time *</Label>
          <Input
            id="scheduledDatetime"
            type="datetime-local"
            {...register("scheduledDatetime")}
            aria-invalid={!!errors.scheduledDatetime}
            aria-describedby={
              errors.scheduledDatetime ? "error-scheduledDatetime" : undefined
            }
            className="min-h-[44px]"
          />
          {errors.scheduledDatetime && (
            <p
              id="error-scheduledDatetime"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.scheduledDatetime.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose</Label>
          <textarea
            id="purpose"
            placeholder="Purpose of appointment (optional)"
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("purpose")}
          />
        </div>

        <div className="space-y-2">
          <Label>Expected visitor photo</Label>
          <p className="text-xs text-muted-foreground">
            Optional. Upload a photo of the person you're expecting so the
            receptionist can match them at the desk.
          </p>
          {photoObjectKey && initialPhotoUrl ? (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <Image
                src={initialPhotoUrl}
                alt="Expected visitor"
                width={64}
                height={64}
                className="h-16 w-16 rounded-md object-cover border"
                unoptimized
              />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Photo on file</p>
                <p className="text-xs text-muted-foreground break-all">
                  {photoObjectKey}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhotoObjectKey(null)}
                    className="min-h-[44px]"
                    aria-label="Remove expected visitor photo"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Remove this photo from the appointment
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <FileUploadZone
              accept="image/*"
              maxSize={5 * 1024 * 1024}
              onUploadComplete={(objectKey) => setPhotoObjectKey(objectKey)}
              placeholder={
                photoObjectKey
                  ? "Replace photo of expected visitor"
                  : "Drop a photo or click to browse"
              }
              helpText="JPG or PNG up to 5MB"
              disabled={submitting}
            />
          )}
          {photoObjectKey && !initialPhotoUrl && (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Photo uploaded — will be attached on save
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhotoObjectKey(null)}
                    className="min-h-[44px] h-9"
                  >
                    <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Discard the uploaded photo before saving
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {tenantRequiredFields.length > 0 && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Tenant-required fields</h3>
              <p className="text-xs text-muted-foreground">
                Defined by your organization's appointment form
                {formRequirementsQuery.data?.tenantFormVersion
                  ? ` (v${formRequirementsQuery.data.tenantFormVersion})`
                  : ""}
                . All fields marked * must be filled before scheduling.
              </p>
            </div>
            {tenantRequiredFields.map((field) => (
              <TenantFormField
                key={field.key}
                field={field}
                value={tenantFormData[field.key]}
                onChange={(value) => setTenantFieldValue(field.key, value)}
                error={tenantFieldErrors[field.key]}
                disabled={submitting}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href="/app/appointments"
                variant="outline"
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                Cancel
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the appointments list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText={isEditing ? "Saving…" : "Scheduling…"}
                  className="w-full md:w-auto"
                >
                  {isEditing ? "Save changes" : "Schedule appointment"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the appointments list"
                : "Schedule this appointment and return to the list"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}

interface TenantFormFieldProps {
  field: AppointmentFormFieldRequirement;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Renders one tenant-required field from the published appointment
 * form. Supports the common scalar types — text, long_text, number,
 * date/datetime, boolean, select, multi_select. File / image /
 * signature / id_document fields are surfaced as a placeholder for
 * now because they need the unified upload pipeline plus a tenant
 * picker; the scheduler is host-driven and rarely needs them.
 */
function TenantFormField({
  field,
  value,
  onChange,
  error,
  disabled,
}: TenantFormFieldProps) {
  const inputId = `tenant-field-${field.key}`;
  const type = field.type ?? "text";
  const label = (
    <Label htmlFor={inputId}>
      {field.label || field.key}
      {field.required && <span aria-hidden="true"> *</span>}
    </Label>
  );

  const helpText = field.helpText ? (
    <p className="text-xs text-muted-foreground">{field.helpText}</p>
  ) : null;

  const errorNode = error ? (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  ) : null;

  if (type === "long_text") {
    return (
      <div className="space-y-2">
        {label}
        <textarea
          id={inputId}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
          disabled={disabled}
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {helpText}
        {errorNode}
      </div>
    );
  }

  if (type === "boolean" || type === "consent_checkbox") {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <input
            id={inputId}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="mt-1 h-5 w-5"
          />
          {label}
        </div>
        {helpText}
        {errorNode}
      </div>
    );
  }

  if (type === "select" && field.options) {
    return (
      <div className="space-y-2">
        {label}
        <SearchableSelect
          id={inputId}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          placeholder={field.placeholder ?? "Select an option"}
          searchPlaceholder="Search options..."
          emptyText="No options match your search"
          triggerClassName="min-h-[44px]"
          options={field.options.map((opt) => ({
            value: opt.key,
            label: opt.label,
          }))}
          disabled={disabled}
        />
        {helpText}
        {errorNode}
      </div>
    );
  }

  if (type === "multi_select" && field.options) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        {label}
        <div className="space-y-1 rounded-md border p-3">
          {field.options.map((opt) => {
            const checked = selected.includes(opt.key);
            return (
              <label
                key={opt.key}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((k) => k !== opt.key)
                      : [...selected, opt.key];
                    onChange(next);
                  }}
                  disabled={disabled}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        {helpText}
        {errorNode}
      </div>
    );
  }

  if (
    type === "file" ||
    type === "image" ||
    type === "signature" ||
    type === "id_document"
  ) {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-3">
        {label}
        <p className="text-xs text-muted-foreground">
          File uploads from this form are not yet wired. Ask the visitor
          to submit this field at check-in instead.
        </p>
        {errorNode}
      </div>
    );
  }

  // text / number / integer / date / time / datetime / url / email / phone
  const inputType =
    type === "number" || type === "integer"
      ? "number"
      : type === "datetime"
        ? "datetime-local"
        : type === "date"
          ? "date"
          : type === "time"
            ? "time"
            : type === "email"
              ? "email"
              : type === "phone"
                ? "tel"
                : type === "url"
                  ? "url"
                  : "text";

  return (
    <div className="space-y-2">
      {label}
      <Input
        id={inputId}
        type={inputType}
        value={
          value === undefined || value === null
            ? ""
            : typeof value === "string" || typeof value === "number"
              ? value
              : ""
        }
        onChange={(e) =>
          onChange(
            inputType === "number"
              ? e.target.value === ""
                ? ""
                : Number(e.target.value)
              : e.target.value,
          )
        }
        placeholder={field.placeholder ?? undefined}
        disabled={disabled}
        className="min-h-[44px]"
      />
      {helpText}
      {errorNode}
    </div>
  );
}
