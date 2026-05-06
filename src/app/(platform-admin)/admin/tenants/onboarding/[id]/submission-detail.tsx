"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  UserCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import {
  useAcceptOnboarding,
  usePartialAcceptOnboarding,
  useRejectOnboarding,
} from "@/features/onboarding/hooks";
import type {
  OnboardingFieldValue,
  OnboardingSubmission,
} from "@/types/onboarding";
import type { OnboardingStatus } from "@/types/enums";
import { PageHeader } from "@/components/recipes/page-header";

const QUEUE_HREF = "/admin/tenants/onboarding";

function statusVariant(status: OnboardingStatus) {
  switch (status) {
    case "new":
      return "info" as const;
    case "accepted":
    case "completed":
      return "success" as const;
    case "partial_accepted":
      return "warning" as const;
    case "rejected":
      return "destructive" as const;
    case "archived":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function renderFieldValue(value: OnboardingFieldValue): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((v) => String(v)).join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === "" || value === null || value === undefined) return "—";
  return String(value);
}

interface ActionState {
  mode: "accept" | "partial" | "reject" | null;
}

interface SubmissionDetailProps {
  submission: OnboardingSubmission;
}

export function OnboardingSubmissionDetail({
  submission,
}: SubmissionDetailProps) {
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();
  const [action, setAction] = useState<ActionState>({ mode: null });

  const orderedKeys = useMemo(() => {
    // Trust the frozen field_order; fall back to payload key order if the
    // service ever returns an empty array (defensive).
    if (submission.fieldOrder?.length) return submission.fieldOrder;
    return Object.keys(submission.payload);
  }, [submission]);

  const isReviewable = submission.status === "new";
  const wasProvisioned =
    submission.status === "accepted" ||
    submission.status === "partial_accepted" ||
    submission.status === "completed";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 min-h-[44px]"
          >
            <Link
              href={QUEUE_HREF}
              onClick={() => handleNavClick(QUEUE_HREF)}
            >
              {loadingHref === QUEUE_HREF ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft
                  className="mr-2 h-4 w-4"
                  aria-hidden="true"
                />
              )}
              Back to onboarding queue
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Return to the onboarding queue
        </TooltipContent>
      </Tooltip>

      <PageHeader
        title={
          submission.organizationName ||
          submission.fullName ||
          "Onboarding submission"
        }
        description={`Submitted ${formatRelative(submission.submittedAt)} • Form version ${submission.formVersion}`}
        actions={
          <Badge variant={statusVariant(submission.status)}>
            {submission.status.replace(/_/g, " ")}
          </Badge>
        }
      />

      {wasProvisioned && submission.tenantId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Provisioned tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <span className="text-muted-foreground">Tenant</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() =>
                      navigate(`/admin/tenants/${submission.tenantId}`)
                    }
                  >
                    Open tenant detail
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Jump to the tenant record this onboarding created
                </TooltipContent>
              </Tooltip>
            </div>
            {submission.superAdminUserId && (
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <span className="text-muted-foreground">Super admin user ID</span>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {submission.superAdminUserId}
                </code>
              </div>
            )}
            {submission.status === "partial_accepted" &&
              submission.pendingFieldKeys?.length ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 font-medium text-warning-foreground">
                  <Clock className="h-4 w-4" />
                  Awaiting tenant completion
                </div>
                <p className="text-muted-foreground">
                  The new super admin still owes:{" "}
                  {submission.pendingFieldKeys
                    .map(
                      (k) =>
                        submission.pendingFieldLabels?.[k] || k,
                    )
                    .join(", ")}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle className="h-4 w-4" />
            Extracted contact
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              Full name
            </div>
            <div className="mt-1 font-medium">
              {submission.fullName || "—"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Email</div>
            <div className="mt-1 flex items-center gap-1 font-medium break-all">
              {submission.email ? (
                <>
                  <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {submission.email}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              Organization
            </div>
            <div className="mt-1 font-medium">
              {submission.organizationName || "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Form responses</CardTitle>
          <span className="text-xs text-muted-foreground">
            {orderedKeys.length} field{orderedKeys.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderedKeys.map((key) => {
            const label = submission.fieldLabels?.[key] ?? key;
            const value = submission.payload[key];
            const isPending =
              submission.pendingFieldKeys?.includes(key) ?? false;
            return (
              <div key={key} className="grid gap-1 md:grid-cols-3 md:gap-4">
                <div className="text-sm font-medium md:col-span-1">
                  <div className="flex items-center gap-2">
                    {label}
                    {isPending && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="warning" className="text-[10px]">
                            pending
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Tenant still owes this field after partial acceptance
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {key}
                  </div>
                </div>
                <div className="text-sm md:col-span-2 break-words">
                  {value === undefined ? (
                    <span className="text-muted-foreground italic">
                      not submitted
                    </span>
                  ) : (
                    renderFieldValue(value)
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submission metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Submitted at</span>
            <span>{formatDateTime(submission.submittedAt)}</span>
          </div>
          {submission.lastUpdated && submission.lastUpdated !== submission.submittedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last updated</span>
              <span>{formatDateTime(submission.lastUpdated)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Form version</span>
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
              {submission.formVersion}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Turnstile</span>
            {submission.turnstileVerified ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ShieldOff className="h-4 w-4" /> Not enforced
              </span>
            )}
          </div>
          {submission.clientIp && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Client IP</span>
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                {submission.clientIp}
              </code>
            </div>
          )}
          {submission.userAgent && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-muted-foreground">User agent</span>
              <span className="text-right text-xs break-all max-w-[60%]">
                <Globe className="mr-1 inline h-3 w-3" />
                {submission.userAgent}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {submission.reviewNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviewer notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap">{submission.reviewNotes}</p>
            {submission.reviewedAt && (
              <p className="text-xs text-muted-foreground">
                Recorded {formatDateTime(submission.reviewedAt)}
                {submission.reviewedBy ? ` by ${submission.reviewedBy}` : ""}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isReviewable && (
        <>
          <Separator />
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => setAction({ mode: "reject" })}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Decline this submission and email reviewer notes to the lead
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => setAction({ mode: "partial" })}
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Partial accept
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Provision the tenant now but flag specific fields the new
                super admin must complete on first login
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="min-h-[44px]"
                  onClick={() => setAction({ mode: "accept" })}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept &amp; provision
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Create the tenant and the first super admin from this
                submission in one step
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}

      <AcceptDialog
        submission={submission}
        open={action.mode === "accept"}
        onClose={() => setAction({ mode: null })}
      />
      <PartialAcceptDialog
        submission={submission}
        open={action.mode === "partial"}
        onClose={() => setAction({ mode: null })}
      />
      <RejectDialog
        submission={submission}
        open={action.mode === "reject"}
        onClose={() => setAction({ mode: null })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accept dialog                                                       */
/* ------------------------------------------------------------------ */

interface AcceptDialogProps {
  submission: OnboardingSubmission;
  open: boolean;
  onClose: () => void;
}

function AcceptDialog({ submission, open, onClose }: AcceptDialogProps) {
  const accept = useAcceptOnboarding();
  const { navigate } = useNavigationLoading();
  const [adminPassword, setAdminPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requiresCompany = !submission.organizationName;
  const requiresName = !submission.fullName;
  const requiresEmail = !submission.email;

  function reset() {
    setAdminPassword("");
    setCompanyName("");
    setAdminFullName("");
    setAdminEmail("");
    setReviewNotes("");
    setShowPassword(false);
  }

  function handleClose() {
    if (accept.isPending) return;
    reset();
    onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (adminPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    toast.promise(
      accept.mutateAsync({
        submissionId: submission.id,
        data: {
          adminPassword,
          companyName: companyName.trim() || undefined,
          adminFullName: adminFullName.trim() || undefined,
          adminEmail: adminEmail.trim() || undefined,
          reviewNotes: reviewNotes.trim() || undefined,
        },
      }),
      {
        loading: "Provisioning tenant…",
        success: (response) => {
          reset();
          onClose();
          if (response?.tenantId) {
            navigate(`/admin/tenants/${response.tenantId}`);
          }
          return "Tenant provisioned. Welcome email queued.";
        },
        error: (err: Error) =>
          err.message || "Failed to provision tenant.",
      },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => (o ? null : handleClose())}
      title="Accept & provision tenant"
      description="Creates the tenant and first super admin in one step. Overrides apply only if you want to change the extracted values."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accept-password">
            Initial admin password <span aria-hidden="true">*</span>
          </Label>
          <div className="relative">
            <Input
              id="accept-password"
              type={showPassword ? "text" : "password"}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className="pr-11 text-base md:text-sm"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showPassword ? "Hide password" : "Show password"}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            The new super admin will be required to change this on first login.
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="accept-company">
            Company name {requiresCompany && <span aria-hidden="true">*</span>}
          </Label>
          <Input
            id="accept-company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={
              submission.organizationName ||
              "Required — submission did not include an org name"
            }
            required={requiresCompany}
            className="text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accept-admin-name">
            Admin full name {requiresName && <span aria-hidden="true">*</span>}
          </Label>
          <Input
            id="accept-admin-name"
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
            placeholder={
              submission.fullName ||
              "Required — submission did not include a name"
            }
            required={requiresName}
            className="text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accept-admin-email">
            Admin email {requiresEmail && <span aria-hidden="true">*</span>}
          </Label>
          <Input
            id="accept-admin-email"
            type="email"
            inputMode="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder={
              submission.email ||
              "Required — submission did not include an email"
            }
            required={requiresEmail}
            className="text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accept-notes">Reviewer notes (optional)</Label>
          <Textarea
            id="accept-notes"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Recorded in the audit trail for this acceptance."
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={handleClose}
                disabled={accept.isPending}
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Close without provisioning the tenant
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={accept.isPending}
                  loadingText="Provisioning…"
                  className="min-h-[44px] w-full md:w-auto"
                >
                  Provision tenant
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Create the tenant + first super admin and queue the welcome email
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </ResponsiveModal>
  );
}

/* ------------------------------------------------------------------ */
/* Partial-accept dialog                                               */
/* ------------------------------------------------------------------ */

function PartialAcceptDialog({ submission, open, onClose }: AcceptDialogProps) {
  const partialAccept = usePartialAcceptOnboarding();
  const { navigate } = useNavigationLoading();
  const [adminPassword, setAdminPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);

  const requiresCompany = !submission.organizationName;
  const requiresName = !submission.fullName;
  const requiresEmail = !submission.email;

  function reset() {
    setAdminPassword("");
    setCompanyName("");
    setAdminFullName("");
    setAdminEmail("");
    setReviewNotes("");
    setPending(new Set());
    setShowPassword(false);
  }

  function handleClose() {
    if (partialAccept.isPending) return;
    reset();
    onClose();
  }

  function togglePending(key: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (adminPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (pending.size === 0) {
      toast.error(
        "Pick at least one field for the tenant to complete — otherwise use Accept.",
      );
      return;
    }

    toast.promise(
      partialAccept.mutateAsync({
        submissionId: submission.id,
        data: {
          adminPassword,
          companyName: companyName.trim() || undefined,
          adminFullName: adminFullName.trim() || undefined,
          adminEmail: adminEmail.trim() || undefined,
          reviewNotes: reviewNotes.trim() || undefined,
          pendingFieldKeys: Array.from(pending),
        },
      }),
      {
        loading: "Provisioning tenant…",
        success: (response) => {
          reset();
          onClose();
          if (response?.tenantId) {
            navigate(`/admin/tenants/${response.tenantId}`);
          }
          return "Tenant provisioned. The super admin will see a completion task on first login.";
        },
        error: (err: Error) =>
          err.message || "Failed to provision tenant.",
      },
    );
  }

  const candidateKeys = submission.fieldOrder?.length
    ? submission.fieldOrder
    : Object.keys(submission.fieldLabels ?? {});

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => (o ? null : handleClose())}
      title="Partial accept"
      description="Provisions the tenant now and records which fields the new super admin must clarify on first login."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="partial-password">
            Initial admin password <span aria-hidden="true">*</span>
          </Label>
          <div className="relative">
            <Input
              id="partial-password"
              type={showPassword ? "text" : "password"}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className="pr-11 text-base md:text-sm"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showPassword ? "Hide password" : "Show password"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {(requiresCompany || requiresName || requiresEmail) && (
          <>
            <Separator />
            {requiresCompany && (
              <div className="space-y-2">
                <Label htmlFor="partial-company">
                  Company name <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="partial-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="text-base md:text-sm"
                />
              </div>
            )}
            {requiresName && (
              <div className="space-y-2">
                <Label htmlFor="partial-name">
                  Admin full name <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="partial-name"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  required
                  className="text-base md:text-sm"
                />
              </div>
            )}
            {requiresEmail && (
              <div className="space-y-2">
                <Label htmlFor="partial-email">
                  Admin email <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="partial-email"
                  type="email"
                  inputMode="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  className="text-base md:text-sm"
                />
              </div>
            )}
          </>
        )}

        <Separator />

        <div className="space-y-2">
          <Label>Fields the tenant must complete on first login</Label>
          <p className="text-xs text-muted-foreground">
            Tick every form field that needs clarification. The super admin
            will land on a completion form for these on their first session.
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
            {candidateKeys.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No fields available to flag.
              </p>
            )}
            {candidateKeys.map((key) => {
              const checked = pending.has(key);
              const label = submission.fieldLabels?.[key] ?? key;
              return (
                <label
                  key={key}
                  htmlFor={`pending-${key}`}
                  className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-muted/40"
                >
                  <Checkbox
                    id={`pending-${key}`}
                    checked={checked}
                    onCheckedChange={() => togglePending(key)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {key}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="partial-notes">
            Reviewer notes <span aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="partial-notes"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Tell the new super admin what to clarify (shown to them when they complete)."
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={handleClose}
                disabled={partialAccept.isPending}
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Close without provisioning the tenant
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={partialAccept.isPending}
                  loadingText="Provisioning…"
                  className="min-h-[44px] w-full md:w-auto"
                >
                  Provision &amp; flag fields
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Create the tenant and queue the partial-acceptance email
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </ResponsiveModal>
  );
}

/* ------------------------------------------------------------------ */
/* Reject dialog                                                       */
/* ------------------------------------------------------------------ */

function RejectDialog({ submission, open, onClose }: AcceptDialogProps) {
  const reject = useRejectOnboarding();
  const [reviewNotes, setReviewNotes] = useState("");

  function handleClose() {
    if (reject.isPending) return;
    setReviewNotes("");
    onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = reviewNotes.trim();
    if (trimmed.length === 0) {
      toast.error("Reviewer notes are required for a rejection email.");
      return;
    }
    if (trimmed.length > 4000) {
      toast.error("Reviewer notes must be 4000 characters or fewer.");
      return;
    }

    toast.promise(
      reject.mutateAsync({
        submissionId: submission.id,
        data: { reviewNotes: trimmed },
      }),
      {
        loading: "Rejecting submission…",
        success: () => {
          setReviewNotes("");
          onClose();
          return "Submission rejected. Email queued.";
        },
        error: (err: Error) =>
          err.message || "Failed to reject submission.",
      },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => (o ? null : handleClose())}
      title="Reject submission"
      description="The reviewer notes you write here go into the rejection email sent to the lead. Be clear about why and what (if anything) they could change."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reject-notes">
            Reviewer notes <span aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="reject-notes"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="e.g. Tier doesn't fit your use case — please reach out to sales for an enterprise quote."
            rows={6}
            maxLength={4000}
            required
          />
          <p className="text-xs text-muted-foreground">
            {reviewNotes.length} / 4000 characters
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={handleClose}
                disabled={reject.isPending}
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close without rejecting</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={reject.isPending}
                  loadingText="Rejecting…"
                  className="min-h-[44px] w-full md:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reject submission
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Decline the submission and email the reviewer notes to the lead
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </ResponsiveModal>
  );
}
