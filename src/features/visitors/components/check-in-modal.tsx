"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Search, UserCheck } from "lucide-react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  useCheckIn,
  useSearchVisitorProfiles,
} from "@/features/visitors/hooks/use-visitors";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import type { CheckInMethod } from "@/types/enums";
import type { VisitorProfile } from "@/types/visitor";

const checkInSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  company: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  hostId: z.string().optional(),
  purpose: z.string().optional(),
  appointmentId: z.string().optional(),
  phone: z.string().min(1, "Phone number is required"),
  checkInMethod: z.enum([
    "qr_registration",
    "id_scan",
    "manual_entry",
  ] as const),
  consentGranted: z.boolean().optional(),
});

type CheckInFormData = z.infer<typeof checkInSchema>;

interface CheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInModal({ open, onOpenChange }: CheckInModalProps) {
  const checkInMutation = useCheckIn();
  const departmentsQuery = useDepartments();

  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [matchedProfile, setMatchedProfile] = useState<VisitorProfile | null>(
    null
  );
  const [showOptional, setShowOptional] = useState(false);

  const searchQuery = useSearchVisitorProfiles(lookupQuery);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      checkInMethod: "manual_entry",
      consentGranted: false,
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setLookupTerm("");
      setLookupQuery("");
      setMatchedProfile(null);
      setShowOptional(false);
    }
  }, [open, reset]);

  const results = searchQuery.data ?? [];
  const showResults = lookupQuery.length >= 2 && !matchedProfile;

  const runLookup = () => {
    const term = lookupTerm.trim();
    if (term.length < 2) {
      toast.info("Enter at least 2 characters to look up");
      return;
    }
    setLookupQuery(term);
  };

  const applyProfile = (profile: VisitorProfile) => {
    setMatchedProfile(profile);
    setValue("fullName", profile.fullName);
    if (profile.phone) setValue("phone", profile.phone);
    if (profile.company) setValue("company", profile.company);
    toast.success(`Welcome back, ${profile.fullName.split(" ")[0]}`);
  };

  const clearProfile = () => {
    setMatchedProfile(null);
    setLookupTerm("");
    setLookupQuery("");
  };

  const checkInMethod = watch("checkInMethod");

  const onSubmit = async (data: CheckInFormData) => {
    try {
      await checkInMutation.mutateAsync({
        fullName: data.fullName,
        company: data.company,
        departmentId: data.departmentId,
        hostId: data.hostId,
        purpose: data.purpose,
        appointmentId: data.appointmentId,
        phone: data.phone,
        checkInMethod: data.checkInMethod as CheckInMethod,
        consentGranted: data.consentGranted,
      });

      toast.success("Visitor registered. Confirm check-in to issue badge.");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to check in visitor"
      );
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Register Visitor"
      description="Look up a returning visitor or register a new entry"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Returning visitor lookup */}
        {!matchedProfile ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 space-y-2">
            <Label
              htmlFor="lookup"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Returning visitor? Look up by phone or name
            </Label>
            <div className="flex gap-2">
              <Input
                id="lookup"
                placeholder="Phone or name"
                value={lookupTerm}
                onChange={(e) => setLookupTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runLookup();
                  }
                }}
                className="flex-1"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={runLookup}
                    disabled={searchQuery.isFetching}
                    aria-label="Look up returning visitor"
                    className="shrink-0"
                  >
                    {searchQuery.isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Search existing visitors so their details prefill and
                  check-in is faster
                </TooltipContent>
              </Tooltip>
            </div>
            {showResults && (
              <div className="space-y-1 pt-1">
                {searchQuery.isFetching && (
                  <p className="text-xs text-muted-foreground">Searching…</p>
                )}
                {!searchQuery.isFetching && results.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No match. Continue below to register as a new visitor.
                  </p>
                )}
                {results.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyProfile(p)}
                    className="flex w-full items-center justify-between rounded border border-border bg-background px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span className="truncate">
                      <span className="font-medium">{p.fullName}</span>
                      {p.company && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {p.company}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {p.visitCount} visit{p.visitCount === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  Returning visitor: {matchedProfile.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {matchedProfile.visitCount} previous visit
                  {matchedProfile.visitCount === 1 ? "" : "s"} · details
                  prefilled
                </p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearProfile}
                >
                  Change
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Clear the matched visitor and search again or register a new one
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Required fields */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            placeholder="Visitor's full name"
            {...register("fullName")}
            aria-invalid={!!errors.fullName}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive" role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="Contact phone"
              {...register("phone")}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && (
              <p className="text-sm text-destructive" role="alert">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentId">Department *</Label>
            <Select
              value={watch("departmentId") || ""}
              onValueChange={(value) =>
                setValue("departmentId", value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="departmentId">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departmentsQuery.isLoading ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Loading departments…
                  </div>
                ) : (departmentsQuery.data?.filter((d) => !!d?.id).length ?? 0) === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No departments found. Create one in Settings first.
                  </div>
                ) : (
                  departmentsQuery.data
                    ?.filter((dept) => !!dept?.id)
                    .map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
            {errors.departmentId && (
              <p className="text-sm text-destructive" role="alert">
                {errors.departmentId.message}
              </p>
            )}
          </div>
        </div>

        {/* Consent */}
        <div className="flex items-center space-x-2">
          <input
            id="consentGranted"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            {...register("consentGranted")}
            aria-label="Visitor consent granted"
          />
          <Label htmlFor="consentGranted" className="font-normal">
            Consent granted for processing
          </Label>
        </div>

        {/* Optional fields toggle */}
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowOptional((v) => !v)}
                className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showOptional ? (
                  <ChevronUp className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                )}
                {showOptional ? "Hide" : "Show"} optional details
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Reveal optional fields like company, host, purpose, appointment
              ID, and check-in method
            </TooltipContent>
          </Tooltip>
        </div>

        {showOptional && (
          <div className="space-y-4 rounded-md border border-border p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Company name"
                  {...register("company")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hostId">Host ID</Label>
                <Input
                  id="hostId"
                  placeholder="Host's ID or email"
                  {...register("hostId")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <textarea
                id="purpose"
                placeholder="Purpose of visit"
                className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register("purpose")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointmentId">Appointment ID</Label>
                <Input
                  id="appointmentId"
                  placeholder="Appointment ID"
                  {...register("appointmentId")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkInMethod">Check-in Method</Label>
                <Select
                  value={checkInMethod}
                  onValueChange={(value) =>
                    setValue("checkInMethod", value as CheckInMethod)
                  }
                >
                  <SelectTrigger id="checkInMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qr_registration">
                      QR Registration
                    </SelectItem>
                    <SelectItem value="id_scan">ID Scan</SelectItem>
                    <SelectItem value="manual_entry">Manual Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex w-full gap-2 pt-2 md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <LoadingButton
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full md:w-auto"
              >
                Cancel
              </LoadingButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this entry and close the registration dialog
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <LoadingButton
                type="submit"
                isLoading={checkInMutation.isPending}
                loadingText="Registering..."
                className="w-full md:w-auto"
              >
                Register
              </LoadingButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Create the visitor session. You&apos;ll then confirm to issue a
              badge.
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </ResponsiveModal>
  );
}
