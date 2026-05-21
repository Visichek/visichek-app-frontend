"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  RotateCcw,
  UserCheck,
  CalendarClock,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { FileUploadZone } from "@/components/recipes/file-upload-zone";
import {
  StepIndicator,
  ReviewRow,
  type StepDef,
} from "@/components/recipes/step-indicator";
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
import { useWizard } from "@/hooks/use-wizard";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSession } from "@/hooks/use-session";
import {
  useAppointmentFormRequirements,
  useCreateAppointment,
  useUpdateAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { useHosts } from "@/features/hosts/hooks/use-hosts";
import { ApiError } from "@/types/api";
import type {
  Appointment,
  AppointmentFormFieldRequirement,
  AppointmentRequest,
} from "@/types/visitor";

/** Wizard steps. Step 3 (Details) is skipped when the tenant published no fields. */
const STEPS: StepDef[] = [
  { id: 1, label: "Who", icon: UserCheck },
  { id: 2, label: "When", icon: CalendarClock },
  { id: 3, label: "Details", icon: ClipboardList },
  { id: 4, label: "Review", icon: CheckCircle2 },
];
const STEPS_NO_DETAILS: StepDef[] = STEPS.filter((s) => s.id !== 3);

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DRAFT_VERSION = 1;

interface AppointmentDraft {
  hostId: string;
  departmentId: string;
  scheduledDatetime: string;
  tenantFormData: Record<string, unknown>;
}

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
  // Hosts now come from the dedicated hosts roster (replacing the old
  // system-user lookup). We submit the host record `id` directly — the
  // backend resolves it through the roster, with a system_user fallback for
  // legacy appointments, so both mirrored and dedicated hosts work.
  const hostsQuery = useHosts({ isActive: true, limit: 200, sort: "name" });
  const { tenantId } = useSession();
  const isEditing = !!appointment;

  const requirements = formRequirementsQuery.data;
  const systemRequired = requirements?.systemRequiredFields ?? [];
  const tenantRequired = requirements?.tenantRequiredFields ?? [];
  const hasDetails = tenantRequired.length > 0;

  // Persisted draft — create mode only. Edit mode hydrates from the
  // `appointment` prop and uses an empty key so it never reads/writes
  // localStorage (a persisted edit draft could shadow server state).
  const draftKey = isEditing ? "" : `visichek:appt-draft:${tenantId ?? "anon"}`;
  const [draft, setDraft, draftControls] = usePersistentState<AppointmentDraft>(
    draftKey,
    {
      hostId: appointment?.hostId ?? "",
      departmentId: appointment?.departmentId ?? "",
      scheduledDatetime: appointment
        ? unixToDatetimeLocal(appointment.scheduledDatetime)
        : "",
      tenantFormData: { ...(appointment?.tenantFormData ?? {}) },
    },
    { ttlMs: DRAFT_TTL_MS, version: DRAFT_VERSION },
  );

  const { hostId, departmentId, scheduledDatetime, tenantFormData } = draft;
  const setHostId = (v: string) => setDraft((d) => ({ ...d, hostId: v }));
  const setDepartmentId = (v: string) =>
    setDraft((d) => ({ ...d, departmentId: v }));
  const setScheduledDatetime = (v: string) =>
    setDraft((d) => ({ ...d, scheduledDatetime: v }));

  const wizard = useWizard({
    steps: hasDetails ? [1, 2, 3, 4] : [1, 2, 4],
    resolveNext: (current) => {
      if (current === 1) return 2;
      if (current === 2) return hasDetails ? 3 : 4;
      if (current === 3) return 4;
      return current;
    },
    resolvePrev: (current) => {
      if (current === 4) return hasDetails ? 3 : 2;
      if (current === 3) return 2;
      if (current === 2) return 1;
      return 1;
    },
    persist: isEditing
      ? undefined
      : {
          key: `visichek:appt-wizard:${tenantId ?? "anon"}`,
          ttlMs: DRAFT_TTL_MS,
          version: DRAFT_VERSION,
        },
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasSavedDraft =
    !isEditing &&
    draftControls.hydrated &&
    (!!draft.hostId ||
      !!draft.departmentId ||
      !!draft.scheduledDatetime ||
      Object.keys(draft.tenantFormData).length > 0);

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
        ?.filter((h) => !!h?.id)
        .map((h) => ({
          value: h.id,
          label: h.email ? `${h.name} (${h.email})` : h.name,
        })) ?? [],
    [hostsQuery.data],
  );

  function setTenantFieldValue(key: string, value: unknown) {
    setDraft((d) => ({
      ...d,
      tenantFormData: { ...d.tenantFormData, [key]: value },
    }));
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

  /**
   * Validate only the fields belonging to the given wizard step. Used as the
   * gate before advancing; the full {@link validate} runs again on submit.
   */
  function validateStep(step: number): boolean {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (systemRequired.some((f) => f.key === SYSTEM_KEYS.hostId) && !hostId) {
        next[SYSTEM_KEYS.hostId] = "Host is required";
      }
      if (
        systemRequired.some((f) => f.key === SYSTEM_KEYS.departmentId) &&
        !departmentId
      ) {
        next[SYSTEM_KEYS.departmentId] = "Department is required";
      }
    } else if (step === 2) {
      if (
        systemRequired.some((f) => f.key === SYSTEM_KEYS.scheduledDatetime) &&
        !scheduledDatetime
      ) {
        next[SYSTEM_KEYS.scheduledDatetime] = "Date and time is required";
      } else if (
        !isEditing &&
        scheduledDatetime &&
        new Date(scheduledDatetime).getTime() <= Date.now()
      ) {
        next[SYSTEM_KEYS.scheduledDatetime] =
          "Scheduled time must be in the future";
      }
    } else if (step === 3) {
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
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNext() {
    if (!validateStep(wizard.step)) {
      toast.error("Fill every required field before continuing.");
      return;
    }
    startTransition(() => wizard.advance());
  }

  function handleBack() {
    startTransition(() => wizard.retreat());
  }

  function startOver() {
    setDraft({
      hostId: "",
      departmentId: "",
      scheduledDatetime: "",
      tenantFormData: {},
    });
    draftControls.clear();
    setFieldErrors({});
    wizard.reset();
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
      // Clear the persisted draft + wizard cursor now the work is committed.
      draftControls.clear();
      wizard.reset();
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
          // Send the user back to the Details step where these live.
          if (hasDetails) wizard.goTo(3);
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
  const visibleSteps = hasDetails ? STEPS : STEPS_NO_DETAILS;

  function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (wizard.step === 4) {
      void onSubmit(event);
    } else {
      handleNext();
    }
  }

  const renderSystemFields = (fields: AppointmentFormFieldRequirement[]) => (
    <SystemFieldsSection
      fields={fields}
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
  );

  const hostLabel =
    hostOptions.find((o) => o.value === hostId)?.label || hostId || "—";
  const departmentLabel =
    departmentOptions.find((o) => o.value === departmentId)?.label ||
    departmentId ||
    "—";
  const scheduledLabel = scheduledDatetime
    ? new Date(scheduledDatetime).toLocaleString()
    : "—";

  const step1Fields = systemRequired.filter(
    (f) =>
      f.key === SYSTEM_KEYS.hostId || f.key === SYSTEM_KEYS.departmentId,
  );
  const step2Fields = systemRequired.filter(
    (f) => f.key === SYSTEM_KEYS.scheduledDatetime,
  );

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
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <StepIndicator
            steps={visibleSteps}
            currentStep={wizard.step}
            completedSteps={wizard.completed}
          />

          {hasSavedDraft && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">
                We restored your unsaved appointment draft.
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startOver}
                    className="shrink-0"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Start over
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Discard the restored draft and start a blank appointment
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {wizard.step === 1 && renderSystemFields(step1Fields)}
          {wizard.step === 2 && renderSystemFields(step2Fields)}

          {wizard.step === 3 && hasDetails && (
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

          {wizard.step === 4 && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold">Review</h3>
              <div>
                <ReviewRow label="Host" value={hostLabel} />
                <ReviewRow label="Department" value={departmentLabel} />
                <ReviewRow label="Scheduled" value={scheduledLabel} />
                {tenantRequired.map((field) => (
                  <ReviewRow
                    key={field.key}
                    label={field.label || field.key}
                    value={formatTenantReviewValue(
                      field,
                      tenantFormData[field.key],
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer navigation */}
          <div className="flex flex-col gap-2 pt-2 md:flex-row md:items-center md:justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                {wizard.isFirst ? (
                  <NavButton
                    href={LIST_HREF}
                    variant="outline"
                    disabled={submitting}
                    className="w-full min-h-[44px] md:w-auto"
                  >
                    Cancel
                  </NavButton>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={submitting || isPending}
                    className="w-full min-h-[44px] md:w-auto"
                  >
                    {isPending ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Back
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent side="top">
                {wizard.isFirst
                  ? "Discard this draft and return to the appointments list"
                  : "Go back to the previous step"}
              </TooltipContent>
            </Tooltip>

            {wizard.step === 4 ? (
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
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    disabled={submitting || isPending}
                    className="w-full md:w-auto"
                  >
                    {isPending ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Validate this step and continue to the next
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Render a tenant field's stored value as a human-readable string for the
 * review step. Maps option keys back to their labels and renders booleans /
 * multi-selects sensibly.
 */
function formatTenantReviewValue(
  field: AppointmentFormFieldRequirement,
  value: unknown,
): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map(
        (v) =>
          field.options?.find((o) => o.key === v)?.label ?? String(v),
      )
      .join(", ");
  }
  if (field.options) {
    return field.options.find((o) => o.key === value)?.label ?? String(value);
  }
  return String(value);
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
 * fields go through {@link FileUploadZone}, which runs the presigned upload
 * flow (`/v1/uploads/intent` → PUT → `/confirm`) and stores the returned
 * `object_key` in the tenant_form_data slot keyed on the field's `key`.
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
