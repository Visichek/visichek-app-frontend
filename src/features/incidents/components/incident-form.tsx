"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { Input } from "@/components/ui/input";
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

const incidentSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  type: z.enum(INCIDENT_TYPES),
  description: z.string().optional(),
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
  const { loadingHref, handleNavClick } = useNavigationLoading();
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
      title: incident?.title ?? "",
      type: (incident?.type as IncidentType) ?? "data_breach",
      description: incident?.description ?? "",
      status: (incident?.status as IncidentStatus) ?? "open",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEditing && incident) {
        await updateMutation.mutateAsync({
          title: data.title,
          description: data.description,
          status: data.status as IncidentStatus,
        });
        toast.success("Incident updated");
      } else {
        await createMutation.mutateAsync({
          title: data.title,
          type: data.type as IncidentType,
          description: data.description,
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
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/incidents"
                onClick={() => handleNavClick("/app/incidents")}
              >
                {loadingHref === "/app/incidents" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to incidents
              </Link>
            </Button>
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
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            placeholder="Brief incident title"
            {...register("title")}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "error-title" : undefined}
            className="min-h-[44px]"
          />
          {errors.title && (
            <p id="error-title" className="text-sm text-destructive" role="alert">
              {errors.title.message}
            </p>
          )}
        </div>

        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="type">Incident type *</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="type" className="min-h-[44px]">
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
            {errors.type && (
              <p className="text-sm text-destructive" role="alert">
                {errors.type.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            placeholder="Detailed incident description (optional)"
            className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("description")}
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
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                <Link
                  href="/app/incidents"
                  onClick={() => handleNavClick("/app/incidents")}
                >
                  Cancel
                </Link>
              </Button>
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
