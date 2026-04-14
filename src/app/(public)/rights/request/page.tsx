"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Copy, CheckCircle2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  usePublicRightsRequest,
  usePublicConsentWithdrawal,
  usePublicProfilingOptOut,
} from "@/features/public-registration/hooks";
import { ApiError } from "@/types/api";
import type { PublicRightsResponse } from "@/types/public";

// ── Schema ───────────────────────────────────────────────────────────

const rightsSchema = z.object({
  request_type: z.enum(
    ["access", "correction", "deletion", "consent_withdrawal"],
    { required_error: "Select a request type" }
  ),
  requesterName: z.string().min(1, "Your name is required"),
  requesterEmail: z
    .string()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  requester_phone: z.string().optional(),
  description: z.string().optional(),
});

type RightsFormValues = z.infer<typeof rightsSchema>;

const REQUEST_TYPES = [
  {
    value: "access" as const,
    label: "Access my data",
    description: "Get a copy of the personal data held about you",
  },
  {
    value: "correction" as const,
    label: "Correct my data",
    description: "Fix inaccurate personal data",
  },
  {
    value: "deletion" as const,
    label: "Delete my data",
    description: "Request removal of your personal data",
  },
  {
    value: "consent_withdrawal" as const,
    label: "Withdraw consent",
    description: "Withdraw previously given consent",
  },
];

// ── Page Component ───────────────────────────────────────────────────

export default function PublicRightsRequestPage() {
  const rightsRequestMutation = usePublicRightsRequest();
  const consentWithdrawalMutation = usePublicConsentWithdrawal();
  const profilingOptOutMutation = usePublicProfilingOptOut();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicRightsResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RightsFormValues>({
    resolver: zodResolver(rightsSchema),
    defaultValues: {
      request_type: undefined,
      requesterName: "",
      requesterEmail: "",
      requester_phone: "",
      description: "",
    },
  });

  const selectedType = watch("request_type");

  async function onSubmit(values: RightsFormValues) {
    setSubmitError(null);

    try {
      const response = await rightsRequestMutation.mutateAsync({
        requestType: values.request_type,
        requesterName: values.requesterName,
        requesterEmail: values.requesterEmail || undefined,
        requesterPhone: values.requester_phone || undefined,
        description: values.description || undefined,
      });
      setResult(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to submit your request. Please try again.");
      }
    }
  }

  async function copyToken() {
    if (!result?.verificationToken) return;
    try {
      await navigator.clipboard.writeText(result.verificationToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }

  // ── Success state ─────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2
                className="h-8 w-8 text-success"
                aria-hidden="true"
              />
            </div>
            <CardTitle className="text-xl font-display">
              Request Submitted
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your data rights request has been received and will be processed.
            </p>

            <div className="space-y-3 rounded-md bg-muted p-4 text-left text-sm">
              <div>
                <span className="font-medium text-foreground">Request ID:</span>{" "}
                <code className="font-mono text-xs">{result.requestId}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  Verification Token:
                </span>
                <code className="flex-1 truncate font-mono text-xs">
                  {result.verificationToken}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToken}
                  className="h-8 w-8 shrink-0 p-0"
                  aria-label="Copy verification token"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {result.dueDate && (
                <div>
                  <span className="font-medium text-foreground">Due by:</span>{" "}
                  {new Date(result.dueDate * 1000).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
              <p className="font-medium text-foreground">
                Save your verification token
              </p>
              <p className="mt-1 text-muted-foreground">
                You will need it to check the status of your request.
              </p>
            </div>

            <Button
              variant="outline"
              asChild
              className="w-full min-h-[44px]"
            >
              <a
                href={`/rights/request/${result.requestId}/status?token=${encodeURIComponent(result.verificationToken)}`}
              >
                Check Request Status
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form state ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-display font-semibold">
          Your Data Rights
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You have the right to access, correct, delete, or withdraw consent
          for your personal data processed during your visit.
        </p>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">Submit a Request</CardTitle>
          <CardDescription>
            Tell us what you need and how we can identify you.
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

            {/* Request type */}
            <div className="space-y-2">
              <Label htmlFor="request_type">
                Request Type <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="request_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="request_type"
                      className="text-base md:text-sm"
                    >
                      <SelectValue placeholder="What would you like to do?" />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.request_type && (
                <p className="text-sm text-destructive">
                  {errors.request_type.message}
                </p>
              )}
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  {REQUEST_TYPES.find((t) => t.value === selectedType)
                    ?.description}
                </p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="requesterName">
                Your Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="requesterName"
                type="text"
                placeholder="Full name"
                autoComplete="name"
                className="text-base md:text-sm"
                {...register("requesterName")}
              />
              {errors.requesterName && (
                <p className="text-sm text-destructive">
                  {errors.requesterName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="requesterEmail">Email</Label>
              <Input
                id="requesterEmail"
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="text-base md:text-sm"
                {...register("requesterEmail")}
              />
              {errors.requesterEmail && (
                <p className="text-sm text-destructive">
                  {errors.requesterEmail.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="requester_phone">Phone Number</Label>
              <Input
                id="requester_phone"
                type="tel"
                inputMode="tel"
                placeholder="+234 800 000 0000"
                autoComplete="tel"
                className="text-base md:text-sm"
                {...register("requester_phone")}
              />
              <p className="text-xs text-muted-foreground">
                Provide at least an email or phone number so we can identify
                your records.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Additional Details</Label>
              <Textarea
                id="description"
                placeholder="Any additional information about your request"
                rows={3}
                className="text-base md:text-sm resize-none"
                {...register("description")}
              />
            </div>

            <LoadingButton
              type="submit"
              isLoading={isSubmitting || rightsRequestMutation.isPending}
              loadingText="Submitting..."
              className="w-full"
            >
              Submit Request
            </LoadingButton>
          </form>
        </CardContent>
      </Card>

      {/* Link to check existing request */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already submitted a request?{" "}
        <a
          href="/rights/request/status"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Check your request status
        </a>
      </p>
    </div>
  );
}
