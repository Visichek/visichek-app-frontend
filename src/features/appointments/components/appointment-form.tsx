"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { FileUploadZone } from "@/components/recipes/file-upload-zone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useSystemUsers } from "@/features/users/hooks/use-users";
import { ApiError } from "@/types/api";
import type {
  Appointment,
  AppointmentFormFieldRequirement,
  AppointmentRequest,
} from "@/types/visitor";

interface AppointmentFormProps {
  /** When set, the form is in edit mode. */
  appointment?: Appointment;
}

const LIST_HREF = "/app/appointments";

const SYSTEM_KEYS = {
  hostId: "host_id",
  departmentId: "department_id",
  scheduledDatetime: "scheduled_datetime",
} as const;

function unixToDatetimeLocal(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Schedule-appointment form.
 *
 * The shape is driven entirely by the backend:
 *
 *   1. `GET /v1/appointments/form-requirements` returns the
 *      `systemRequiredFields` (always host_id, department_id,
 *      scheduled_datetime) and the tenant's `tenantRequiredFields`
 *      list (from the published appointment form, or `[]` when none).
 *   2. The form renders one input per system field (with the right
 *      picker per `key`) and one input per tenant field (via the
 *      generic {@link TenantFormField} renderer below).
 *   3. The submit payload is `host_id` + `department_id` +
 *      `scheduled_datetime` at the top level, plus `tenant_form_data`
 *      keyed on the tenant field ids.
 *
 * Optional snapshot fields on the backend's `AppointmentCreate` schema
 * (visitor_name_snapshot, purpose, expected_visitor_photo_object_key,
 * etc.) are NOT hardcoded here. Tenants that need them publish them
 * via the form builder and they appear in `tenantRequiredFields`.
 */
export function AppointmentForm({ appointment }: AppointmentFormProps) {
  const { loadingHref, navigate } = useNavigationLoading();
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const formRequirementsQuery = useAppointmentFormRequirements();
  const departmentsQuery = useDepartments();
  // Hosts are tenant staff — every system_user is a candidate host.
  // The backend reads role from the assigned record so we don't filter.
  const hostsQuery = useSystemUsers({ limit: 200 });
  const isEditing = !!appointment;

  const requirements = formRequirementsQuery.data;
  const systemRequired = requirements?.systemRequiredFields ?? [];
  const tenantRequired = requirements?.tenantRequiredFields ?? [];

  // System fields (host_id, department_id, scheduled_datetime). The
  // form-requirements endpoint only carries the keys; we pick the
  // matching input by key here.
  const [hostId, setHostId] = useState(appointment?.hostId ?? "");
  const [departmentId, setDepartmentId] = useState(
    appointment?.departmentId ?? "",
  );
  const [scheduledDatetime, setScheduledDatetime] = useState(
    appointment ? unixToDatetimeLocal(appointment.scheduledDatetime) : "",
  );

  // tenant_form_data keyed on the published form's field_id. Lives
  // outside react-hook-form because the dynamic field set can grow /
  // shrink without re-registering schemas.
  const [tenantFormData, setTenantFormData] = useState<Record<string, unknown>>(
    () => ({ ...(appointment?.tenantFormData ?? {}) }),
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const departmentOptions = useMemo(
    () =>
      departmentsQuery.data?.items
        ?.filter((d) => !!d?.id)
        .map((d) => ({ value: d.id, label: d.name })) ?? [],
    [departmentsQuery.data],
  );

  const hostOptions = useMemo(
    () =>
      hostsQuery.data?.items
        ?.filter((u) => !!u?.id)
        .map((u) => ({
          value: u.id,
          label: u.email ? `${u.fullName} (${u.email})` : u.fullName,
        })) ?? [],
    [hostsQuery.data],
  );

  function setTenantFieldValue(key: string, value: unknown) {
    setTenantFormData((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function clearError(key: string) {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function buildTenantFormDataPayload(): Record<string, unknown> | undefined {
    const clean: Record<string, unknown> = {};
    for (const field of tenantRequired) {
      const value = tenantFormData[field.key];
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0)
      ) {
        continue;
      }
      clean[field.key] = value;
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};

    // System fields are always required regardless of what the
    // requirements endpoint says (the backend enforces these
    // unconditionally — they're listed for symmetry only).
    if (systemRequired.some((f) => f.key === SYSTEM_KEYS.hostId) && !hostId) {
      next[SYSTEM_KEYS.hostId] = "Host is required";
    }
    if (
      systemRequired.some((f) => f.key === SYSTEM_KEYS.departmentId) &&
      !departmentId
    ) {
      next[SYSTEM_KEYS.departmentId] = "Department is required";
    }
    if (
      systemRequired.some((f) => f.key === SYSTEM_KEYS.scheduledDatetime) &&
      !scheduledDatetime
    ) {
      next[SYSTEM_KEYS.scheduledDatetime] = "Date and time is required";
    }

    for (const field of tenantRequired) {
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

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) {
      toast.error("Fill every required field before submitting.");
      return;
    }

    const scheduledUnix = Math.floor(
      new Date(scheduledDatetime).getTime() / 1000,
    );
    const tenantFormDataPayload = buildTenantFormDataPayload();

    const payload: AppointmentRequest = {
      tenantId: "", // server fills from session
      hostId,
      departmentId,
      scheduledDatetime: scheduledUnix,
      ...(tenantFormDataPayload
        ? { tenantFormData: tenantFormDataPayload }
        : {}),
    };

    setSubmitting(true);
    try {
      if (isEditing && appointment) {
        await updateMutation.mutateAsync({
          appointmentId: appointment.id,
          data: payload,
        });
        toast.success("Appointment updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Appointment created");
      }
      navigate(LIST_HREF);
    } catch (err) {
      // 400 VALIDATION_FAILED with details.missing_fields = [...] →
      // map each missing field_id back to its inline error.
      if (err instanceof ApiError && err.status === 400) {
        const details = err.details;
        const missingRaw =
          details && typeof details === "object"
            ? (details as {
                missing_fields?: unknown;
                missingFields?: unknown;
              })
            : undefined;
        const list =
          (missingRaw?.missing_fields as unknown) ??
          (missingRaw?.missingFields as unknown);
        if (Array.isArray(list) && list.length > 0) {
          const next: Record<string, string> = {};
          for (const key of list) {
            if (typeof key !== "string") continue;
            const tenantField = tenantRequired.find((f) => f.key === key);
            next[key] = `${tenantField?.label || key} is required`;
          }
          setFieldErrors(next);
          toast.error("Some required fields are missing.");
          return;
        }
      }
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} appointment`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const requirementsLoading = formRequirementsQuery.isLoading;
  const requirementsError = formRequirementsQuery.isError;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton
              href={LIST_HREF}
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
            >
              {loadingHref === LIST_HREF ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
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

      {requirementsLoading ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading form requirements…
        </div>
      ) : requirementsError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load appointment form requirements. Refresh and try
          again.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <SystemFieldsSection
            fields={systemRequired}
            hostId={hostId}
            onHostIdChange={(v) => {
              setHostId(v);
              clearError(SYSTEM_KEYS.hostId);
            }}
            hostOptions={hostOptions}
            hostsLoading={hostsQuery.isLoading}
            departmentId={departmentId}
            onDepartmentIdChange={(v) => {
              setDepartmentId(v);
              clearError(SYSTEM_KEYS.departmentId);
            }}
            departmentOptions={departmentOptions}
            departmentsLoading={departmentsQuery.isLoading}
            scheduledDatetime={scheduledDatetime}
            onScheduledDatetimeChange={(v) => {
              setScheduledDatetime(v);
              clearError(SYSTEM_KEYS.scheduledDatetime);
            }}
            errors={fieldErrors}
          />

          {tenantRequired.length > 0 && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">
                  Tenant-required fields
                </h3>
                <p className="text-xs text-muted-foreground">
                  Defined by your organization's appointment form
                  {requirements?.tenantFormVersion
                    ? ` (v${requirements.tenantFormVersion})`
                    : ""}
                  . Fields marked * must be filled before scheduling.
                </p>
              </div>
              {tenantRequired.map((field) => (
                <TenantFormField
                  key={field.key}
                  field={field}
                  value={tenantFormData[field.key]}
                  onChange={(value) => setTenantFieldValue(field.key, value)}
                  error={fieldErrors[field.key]}
                  disabled={submitting}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href={LIST_HREF}
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
      )}
    </div>
  );
}

interface SystemFieldsSectionProps {
  fields: AppointmentFormFieldRequirement[];
  hostId: string;
  onHostIdChange: (value: string) => void;
  hostOptions: Array<{ value: string; label: string }>;
  hostsLoading: boolean;
  departmentId: string;
  onDepartmentIdChange: (value: string) => void;
  departmentOptions: Array<{ value: string; label: string }>;
  departmentsLoading: boolean;
  scheduledDatetime: string;
  onScheduledDatetimeChange: (value: string) => void;
  errors: Record<string, string>;
}

function SystemFieldsSection(props: SystemFieldsSectionProps) {
  const hasHost = props.fields.some((f) => f.key === SYSTEM_KEYS.hostId);
  const hasDepartment = props.fields.some(
    (f) => f.key === SYSTEM_KEYS.departmentId,
  );
  const hasScheduled = props.fields.some(
    (f) => f.key === SYSTEM_KEYS.scheduledDatetime,
  );

  return (
    <div className="space-y-5">
      {hasHost && (
        <div className="space-y-2">
          <Label htmlFor="host_id">Host *</Label>
          <SearchableSelect
            id="host_id"
            value={props.hostId}
            onValueChange={props.onHostIdChange}
            placeholder={
              props.hostsLoading ? "Loading hosts..." : "Select a host"
            }
            searchPlaceholder="Search hosts..."
            emptyText="No hosts match your search"
            triggerClassName="min-h-[44px]"
            options={props.hostOptions}
          />
          {props.errors[SYSTEM_KEYS.hostId] && (
            <p className="text-sm text-destructive" role="alert">
              {props.errors[SYSTEM_KEYS.hostId]}
            </p>
          )}
        </div>
      )}

      {hasDepartment && (
        <div className="space-y-2">
          <Label htmlFor="department_id">Department *</Label>
          <SearchableSelect
            id="department_id"
            value={props.departmentId}
            onValueChange={props.onDepartmentIdChange}
            placeholder={
              props.departmentsLoading
                ? "Loading departments..."
                : "Select a department"
            }
            searchPlaceholder="Search departments..."
            emptyText="No departments match your search"
            triggerClassName="min-h-[44px]"
            options={props.departmentOptions}
          />
          {props.errors[SYSTEM_KEYS.departmentId] && (
            <p className="text-sm text-destructive" role="alert">
              {props.errors[SYSTEM_KEYS.departmentId]}
            </p>
          )}
        </div>
      )}

      {hasScheduled && (
        <div className="space-y-2">
          <Label htmlFor="scheduled_datetime">Scheduled date &amp; time *</Label>
          <Input
            id="scheduled_datetime"
            type="datetime-local"
            value={props.scheduledDatetime}
            onChange={(e) => props.onScheduledDatetimeChange(e.target.value)}
            className="min-h-[44px]"
          />
          {props.errors[SYSTEM_KEYS.scheduledDatetime] && (
            <p className="text-sm text-destructive" role="alert">
              {props.errors[SYSTEM_KEYS.scheduledDatetime]}
            </p>
          )}
        </div>
      )}
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
 * form. Switches on `field.type` to pick the right input. File-bearing
 * fields go through {@link FileUploadZone}, which posts to the unified
 * `/v1/uploads/private` endpoint and stores the returned `object_key`
 * in the tenant_form_data slot keyed on the field's `key`.
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
    const objectKey = typeof value === "string" ? value : "";
    return (
      <div className="space-y-2">
        {label}
        {objectKey ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-xs">
            <span className="font-mono break-all">{objectKey}</span>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="ml-3 underline text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>
        ) : (
          <FileUploadZone
            accept={type === "image" || type === "signature" ? "image/*" : undefined}
            maxSize={10 * 1024 * 1024}
            purpose="kiosk_form"
            fieldId={field.key}
            onUploadComplete={(newObjectKey) => onChange(newObjectKey)}
            placeholder={field.placeholder ?? "Drop a file or click to browse"}
            disabled={disabled}
          />
        )}
        {helpText}
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
