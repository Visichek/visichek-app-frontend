"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useCreateIncident,
  useUpdateIncident,
} from "@/features/incidents/hooks/use-incidents";
import type { Incident } from "@/types/incident";
import type { IncidentStatus, IncidentType } from "@/types/enums";

const INCIDENT_TYPES = [
  "data_breach",
  "unauthorized_access",
  "data_export_exposure",
  "device_loss",
  "misconfiguration",
  "third_party",
] as const;

const INCIDENT_STATUSES = [
  "open",
  "investigating",
  "contained",
  "reported_to_ndpc",
  "closed",
] as const;

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

const incidentSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  incidentType: z.enum(INCIDENT_TYPES),
  riskLevel: z.enum(RISK_LEVELS),
  status: z.enum(INCIDENT_STATUSES),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface IncidentFormProps {
  /** When set, the form is in edit mode. */
  incident?: Incident;
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function IncidentForm({ incident }: IncidentFormProps) {
  const router = useRouter();
  const { loadingHref } = useNavigationLoading();
  const createMutation = useCreateIncident();
  const updateMutation = useUpdateIncident(incident?.id ?? "");
  const isEditing = !!incident;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      description: incident?.description ?? "",
      incidentType: (incident?.incidentType as IncidentType) ?? "data_breach",
      riskLevel: (incident?.riskLevel as IncidentFormData["riskLevel"]) ?? "low",
      status: (incident?.status as IncidentStatus) ?? "open",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEditing && incident) {
        await updateMutation.mutateAsync({
          description: data.description,
          riskLevel: data.riskLevel,
          status: data.status as IncidentStatus,
        });
        toast.success("Incident updated");
      } else {
        await createMutation.mutateAsync({
          description: data.description,
          incidentType: data.incidentType as IncidentType,
          riskLevel: data.riskLevel,
        });
        toast.success("Incident reported");
      }
      router.push("/app/incidents");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} incident`,
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
            <NavButton href="/app/incidents" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/app/incidents" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to incidents
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the incidents list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit incident" : "Report incident"}
        description={
          isEditing
            ? "Update this incident's details and status."
            : "Log a new security or data-protection incident for triage."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <textarea
            id="description"
            placeholder="What happened? Include enough detail for triage."
            className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("description")}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "error-description" : undefined}
          />
          {errors.description && (
            <p id="error-description" className="text-sm text-destructive" role="alert">
              {errors.description.message}
            </p>
          )}
        </div>

        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="incidentType">Incident type *</Label>
            <Controller
              name="incidentType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="incidentType" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatType(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.incidentType && (
              <p className="text-sm text-destructive" role="alert">
                {errors.incidentType.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="riskLevel">Risk level *</Label>
          <Controller
            name="riskLevel"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="riskLevel" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {formatType(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {isEditing && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {formatType(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href="/app/incidents"
                variant="outline"
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                Cancel
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the incidents list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText={isEditing ? "Saving…" : "Reporting…"}
                  className="w-full md:w-auto"
                >
                  {isEditing ? "Save changes" : "Report incident"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the incidents list"
                : "File this incident and return to the list"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
