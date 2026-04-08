"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
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
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { usePublicRightsStatus } from "@/features/public-registration/hooks";

// ── Status badge mapping ─────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }
> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  in_progress: { label: "In Progress", variant: "default", icon: Loader2 },
  completed: { label: "Completed", variant: "outline", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: AlertCircle },
};

// ── Lookup schema ────────────────────────────────────────────────────

const lookupSchema = z.object({
  verificationToken: z.string().min(1, "Verification token is required"),
});

type LookupFormValues = z.infer<typeof lookupSchema>;

// ── Page Component ───────────────────────────────────────────────────

export default function DSRStatusPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const requestId = params.requestId as string;
  const tokenFromUrl = searchParams.get("token") || "";

  const [activeToken, setActiveToken] = useState(tokenFromUrl);

  const {
    data: statusData,
    isLoading,
    error,
    refetch,
  } = usePublicRightsStatus(requestId, activeToken);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<LookupFormValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      verificationToken: tokenFromUrl,
    },
  });

  function onLookup(values: LookupFormValues) {
    setActiveToken(values.verificationToken);
  }

  // ── Token entry when not provided in URL ──────────────────────────
  if (!activeToken) {
    return (
      <div className="flex flex-col items-center px-4 py-8 md:py-12">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Search className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-display font-semibold">
            Check Request Status
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Enter the verification token you received when you submitted your
            request.
          </p>
        </div>

        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <form
              onSubmit={handleSubmit(onLookup)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="verificationToken">
                  Verification Token{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="verificationToken"
                  type="text"
                  placeholder="Paste your verification token"
                  autoFocus
                  className="text-base md:text-sm font-mono"
                  {...register("verificationToken")}
                />
                {formErrors.verificationToken && (
                  <p className="text-sm text-destructive">
                    {formErrors.verificationToken.message}
                  </p>
                )}
              </div>

              <LoadingButton type="submit" className="w-full">
                Look Up Status
              </LoadingButton>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <a
            href="/rights/request"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Submit a new request
          </a>
        </p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Looking up your request...
          </p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (error || !statusData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <ErrorState
          title="Request not found"
          message="We could not find a request with that ID and token. Please check your details and try again."
          onRetry={() => {
            setActiveToken("");
          }}
        />
      </div>
    );
  }

  // ── Status display ────────────────────────────────────────────────
  const config = STATUS_CONFIG[statusData.status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  return (
    <div className="flex flex-col items-center px-4 py-8 md:py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-display">Request Status</CardTitle>
          <CardDescription>
            Request ID:{" "}
            <code className="font-mono text-xs">{statusData.request_id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center justify-center gap-2">
            <StatusIcon
              className="h-5 w-5"
              aria-hidden="true"
            />
            <Badge variant={config.variant} className="text-sm px-3 py-1">
              {config.label}
            </Badge>
          </div>

          {/* Details */}
          <div className="space-y-3 rounded-md bg-muted p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">
                {statusData.type.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-medium">
                {new Date(statusData.createdAt * 1000).toLocaleDateString()}
              </span>
            </div>
            {statusData.dueDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due by</span>
                <span className="font-medium">
                  {new Date(statusData.dueDate * 1000).toLocaleDateString()}
                </span>
              </div>
            )}
            {statusData.updatedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last updated</span>
                <span className="font-medium">
                  {new Date(
                    statusData.updatedAt * 1000
                  ).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Guidance */}
          {statusData.status === "pending" && (
            <p className="text-center text-sm text-muted-foreground">
              Your request is queued and will be reviewed shortly.
            </p>
          )}
          {statusData.status === "in_progress" && (
            <p className="text-center text-sm text-muted-foreground">
              Your request is being processed. Check back for updates.
            </p>
          )}
          {statusData.status === "completed" && (
            <p className="text-center text-sm text-muted-foreground">
              Your request has been fulfilled. If you have questions, contact
              the organisation directly.
            </p>
          )}
          {statusData.status === "rejected" && (
            <p className="text-center text-sm text-muted-foreground">
              Your request was declined. Contact the organisation for more
              details.
            </p>
          )}

          <LoadingButton
            variant="outline"
            onClick={() => refetch()}
            isLoading={isLoading}
            loadingText="Refreshing..."
            className="w-full"
          >
            Refresh Status
          </LoadingButton>
        </CardContent>
      </Card>
    </div>
  );
}
