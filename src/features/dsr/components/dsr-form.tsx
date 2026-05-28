"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, UserRound, X } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
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
  useCreateDSR,
  useUpdateDSR,
} from "@/features/dsr/hooks/use-dsr";
import { useSearchVisitorProfiles } from "@/features/visitors/hooks/use-visitors";
import type { DataSubjectRequest } from "@/types/dpo";
import type { VisitorProfile } from "@/types/visitor";
import type { DSRStatus, DSRType } from "@/types/enums";

const DSR_TYPES = [
  "access",
  "correction",
  "deletion",
  "consent_withdrawal",
] as const;

const DSR_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "rejected",
] as const;

const dsrSchema = z.object({
  // Required on create (enforced in onSubmit since the picker only shows
  // in create mode); irrelevant when editing an existing request.
  visitorProfileId: z.string().optional(),
  requesterName: z.string().trim().min(1, "Requester name is required"),
  requesterEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  type: z.enum(DSR_TYPES),
  description: z.string().optional(),
  status: z.enum(DSR_STATUSES),
});

type DSRFormData = z.infer<typeof dsrSchema>;

const TYPE_LABELS: Record<(typeof DSR_TYPES)[number], string> = {
  access: "Right of Access",
  correction: "Right to Correction",
  deletion: "Right to Deletion",
  consent_withdrawal: "Consent Withdrawal",
};

const STATUS_LABELS: Record<(typeof DSR_STATUSES)[number], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};

interface DSRFormProps {
  /** When set, the form is in edit mode. */
  dsr?: DataSubjectRequest;
}

export function DSRForm({ dsr }: DSRFormProps) {
  const router = useRouter();
  const { loadingHref } = useNavigationLoading();
  const createMutation = useCreateDSR();
  const updateMutation = useUpdateDSR(dsr?.id ?? "");
  const isEditing = !!dsr;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DSRFormData>({
    resolver: zodResolver(dsrSchema),
    defaultValues: {
      visitorProfileId: "",
      requesterName: dsr?.requesterName ?? "",
      requesterEmail: dsr?.requesterEmail ?? "",
      type: (dsr?.type as DSRType) ?? "access",
      description: dsr?.description ?? "",
      status: (dsr?.status as DSRStatus) ?? "pending",
    },
  });

  // ── Visitor picker (create only) ──────────────────────────────────
  // The backend requires `visitor_profile_id` on POST /v1/dsr. We resolve
  // it by searching visitor profiles and letting the user pick one.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedVisitor, setSelectedVisitor] =
    useState<VisitorProfile | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const { data: visitorResults, isFetching: isSearching } =
    useSearchVisitorProfiles(debouncedSearch);

  function selectVisitor(visitor: VisitorProfile) {
    setSelectedVisitor(visitor);
    setValue("visitorProfileId", visitor.id, { shouldValidate: true });
    // Prefill requester identity from the chosen profile; the user can
    // still edit these before submitting.
    setValue("requesterName", visitor.fullName);
    if (visitor.email) setValue("requesterEmail", visitor.email);
    setSearch("");
    setDebouncedSearch("");
  }

  function clearVisitor() {
    setSelectedVisitor(null);
    setValue("visitorProfileId", "");
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEditing && dsr) {
        await updateMutation.mutateAsync({
          status: data.status as DSRStatus,
          description: data.description,
        });
        toast.success("Request updated");
      } else {
        if (!data.visitorProfileId) {
          setError("visitorProfileId", {
            type: "required",
            message: "Select the visitor this request is about",
          });
          return;
        }
        await createMutation.mutateAsync({
          visitorProfileId: data.visitorProfileId,
          requesterName: data.requesterName,
          requesterEmail: data.requesterEmail || undefined,
          requestType: data.type as DSRType,
          description: data.description,
        });
        toast.success("Request created");
      }
      router.push("/app/dpo");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} request`,
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
            <NavButton href="/app/dpo" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/app/dpo" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to data protection
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the data protection workspace without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit data subject request" : "New data subject request"}
        description={
          isEditing
            ? "Update this request's status and notes."
            : "Register a new data subject request for triage."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="visitor-search">Visitor *</Label>
            <p className="text-sm text-muted-foreground">
              Search for and select the visitor whose data this request
              concerns. The request cannot be created without one.
            </p>

            {selectedVisitor ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-muted/40 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {selectedVisitor.fullName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[selectedVisitor.company, selectedVisitor.phone]
                        .filter(Boolean)
                        .join(" · ") || "No additional details"}
                    </p>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearVisitor}
                      className="min-h-[44px] shrink-0"
                      aria-label="Choose a different visitor"
                    >
                      <X className="mr-1 h-4 w-4" aria-hidden="true" />
                      Change
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Clear this visitor and search for a different one
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="visitor-search"
                    type="search"
                    placeholder="Search by name, phone, or company…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-invalid={!!errors.visitorProfileId}
                    aria-describedby={
                      errors.visitorProfileId
                        ? "error-visitorProfileId"
                        : undefined
                    }
                    className="min-h-[44px] pl-9"
                  />
                </div>

                {debouncedSearch.length >= 2 && (
                  <div
                    className="max-h-60 overflow-y-auto rounded-md border border-input"
                    role="listbox"
                    aria-label="Visitor search results"
                  >
                    {isSearching ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Searching…
                      </div>
                    ) : !visitorResults || visitorResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        No visitors match “{debouncedSearch}”.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {visitorResults.map((visitor) => (
                          <li key={visitor.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected="false"
                                  onClick={() => selectVisitor(visitor)}
                                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                                >
                                  <UserRound
                                    className="h-4 w-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">
                                      {visitor.fullName}
                                    </span>
                                    <span className="block truncate text-sm text-muted-foreground">
                                      {[visitor.company, visitor.phone]
                                        .filter(Boolean)
                                        .join(" · ") || visitor.email || "—"}
                                    </span>
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                Select {visitor.fullName} as the data subject
                                for this request
                              </TooltipContent>
                            </Tooltip>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {debouncedSearch.length > 0 && debouncedSearch.length < 2 && (
                  <p className="text-xs text-muted-foreground">
                    Type at least 2 characters to search.
                  </p>
                )}
              </div>
            )}

            {errors.visitorProfileId && (
              <p
                id="error-visitorProfileId"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.visitorProfileId.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="requesterName">Requester name *</Label>
          <Input
            id="requesterName"
            placeholder="Full name of data subject"
            {...register("requesterName")}
            aria-invalid={!!errors.requesterName}
            aria-describedby={
              errors.requesterName ? "error-requesterName" : undefined
            }
            className="min-h-[44px]"
            disabled={isEditing}
          />
          {errors.requesterName && (
            <p
              id="error-requesterName"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.requesterName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="requesterEmail">Requester email</Label>
          <Input
            id="requesterEmail"
            type="email"
            inputMode="email"
            placeholder="Email address (optional)"
            {...register("requesterEmail")}
            aria-invalid={!!errors.requesterEmail}
            aria-describedby={
              errors.requesterEmail ? "error-requesterEmail" : undefined
            }
            className="min-h-[44px]"
            disabled={isEditing}
          />
          {errors.requesterEmail && (
            <p
              id="error-requesterEmail"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.requesterEmail.message}
            </p>
          )}
        </div>

        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="type">Request type *</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="type" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DSR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Notes</Label>
          <textarea
            id="description"
            placeholder="Additional notes or details (optional)"
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    {DSR_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
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
                href="/app/dpo"
                variant="outline"
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                Cancel
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the data protection workspace
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText={isEditing ? "Saving…" : "Creating…"}
                  className="w-full md:w-auto"
                >
                  {isEditing ? "Save changes" : "Create request"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the data protection workspace"
                : "Create this request and return to the data protection workspace"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
