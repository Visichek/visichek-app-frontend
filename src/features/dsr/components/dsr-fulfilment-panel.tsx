"use client";

/**
 * Type-specific fulfilment panel for a single Data Subject Request.
 *
 * Each DSR type maps to a concrete action — not just a status flip:
 *   access              → verify identity, then gather + email the data export
 *   correction          → apply allowlisted profile corrections
 *   consent_withdrawal  → revoke consent + disable profiling
 *   deletion            → schedule the visitor-profile erasure
 * plus the shared acknowledge / reject workflow. Every fulfilment POST returns
 * 202 and the API client auto-polls the job to terminal, so a failure (e.g.
 * `DSR_ACCESS_NO_EMAIL`) rejects the mutation and we surface it as a toast.
 */

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  FileDown,
  Mail,
  PlayCircle,
  ShieldCheck,
  UserCog,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import {
  useAcknowledgeDSR,
  useFulfilAccessDSR,
  useFulfilConsentWithdrawalDSR,
  useFulfilCorrectionDSR,
  useFulfilDeletionDSR,
  useRejectDSR,
  useVerifyDSRIdentity,
} from "@/features/dsr/hooks/use-dsr";
import type { DataSubjectRequest, DSRCorrectionRequest } from "@/types/dpo";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function DSRFulfilmentPanel({ dsr }: { dsr: DataSubjectRequest }) {
  const { hasCapability } = useCapabilities();
  const canEdit = hasCapability(CAPABILITIES.DSR_EDIT);
  const canErase = hasCapability(CAPABILITIES.VISITOR_ERASE);

  const requestType = dsr.requestType ?? dsr.type;
  const isClosed = dsr.status === "completed" || dsr.status === "rejected";
  const subjectName =
    dsr.visitorProfileSummary?.fullName || dsr.requesterName || "this visitor";
  const subjectEmail = dsr.visitorProfileSummary?.emailAddress;

  // ── Mutations ────────────────────────────────────────────────────────
  const acknowledge = useAcknowledgeDSR();
  const reject = useRejectDSR();
  const verifyIdentity = useVerifyDSRIdentity(dsr.id);
  const fulfilAccess = useFulfilAccessDSR(dsr.id);
  const fulfilConsent = useFulfilConsentWithdrawalDSR(dsr.id);
  const fulfilCorrection = useFulfilCorrectionDSR(dsr.id);
  const fulfilDeletion = useFulfilDeletionDSR(dsr.id);

  // ── Local UI state ───────────────────────────────────────────────────
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [consentConfirm, setConsentConfirm] = useState(false);
  const [deletionConfirm, setDeletionConfirm] = useState(false);
  const [correction, setCorrection] = useState<DSRCorrectionRequest>({
    fullName: dsr.visitorProfileSummary?.fullName ?? "",
    phone: dsr.visitorProfileSummary?.phone ?? "",
    emailAddress: dsr.visitorProfileSummary?.emailAddress ?? "",
    company: dsr.visitorProfileSummary?.company ?? "",
  });

  // ── Closed state ─────────────────────────────────────────────────────
  if (isClosed) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fulfilment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            This request has been{" "}
            <span className="font-medium text-foreground">{dsr.status}</span>.
            No further action is required.
          </p>
          {dsr.accessExportEmailedTo && (
            <p className="flex items-start gap-2">
              <Mail
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                Data export emailed to{" "}
                <span className="font-medium text-foreground">
                  {dsr.accessExportEmailedTo}
                </span>
                .
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── No permission ────────────────────────────────────────────────────
  if (!canEdit) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fulfilment</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You don&apos;t have permission to action data subject requests.
        </CardContent>
      </Card>
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  async function handleVerifyToggle(next: boolean) {
    try {
      await verifyIdentity.mutateAsync(next);
      toast.success(
        next ? "Identity marked verified" : "Identity verification cleared",
      );
    } catch (err) {
      toast.error(errMessage(err, "Couldn't update identity verification"));
    }
  }

  async function handleAccess() {
    try {
      await fulfilAccess.mutateAsync();
      toast.success(`Data export generated and emailed to ${subjectEmail}`);
    } catch (err) {
      toast.error(errMessage(err, "Couldn't generate the data export"));
    }
  }

  async function handleCorrection() {
    const payload: DSRCorrectionRequest = {};
    if (correction.fullName?.trim()) payload.fullName = correction.fullName.trim();
    if (correction.phone?.trim()) payload.phone = correction.phone.trim();
    if (correction.emailAddress?.trim())
      payload.emailAddress = correction.emailAddress.trim();
    if (correction.company?.trim()) payload.company = correction.company.trim();
    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one corrected value");
      return;
    }
    try {
      await fulfilCorrection.mutateAsync(payload);
      toast.success("Profile corrected and request completed");
    } catch (err) {
      toast.error(errMessage(err, "Couldn't apply the correction"));
    }
  }

  async function handleConsent() {
    try {
      await fulfilConsent.mutateAsync();
      toast.success("Consent withdrawn and profiling disabled");
      setConsentConfirm(false);
    } catch (err) {
      toast.error(errMessage(err, "Couldn't withdraw consent"));
    }
  }

  async function handleDeletion() {
    try {
      await fulfilDeletion.mutateAsync();
      toast.success("Erasure scheduled — permanent deletion in 14 days");
      setDeletionConfirm(false);
    } catch (err) {
      toast.error(errMessage(err, "Couldn't schedule the erasure"));
    }
  }

  async function handleAcknowledge() {
    try {
      await acknowledge.mutateAsync(dsr.id);
      toast.success("Request acknowledged — now in progress");
    } catch (err) {
      toast.error(errMessage(err, "Couldn't acknowledge the request"));
    }
  }

  async function handleReject() {
    try {
      await reject.mutateAsync({
        dsrId: dsr.id,
        reason: rejectReason.trim() || undefined,
      });
      toast.success("Request rejected");
      setRejectOpen(false);
      setRejectReason("");
    } catch (err) {
      toast.error(errMessage(err, "Couldn't reject the request"));
    }
  }

  const accessReady = !!dsr.identityVerified && !!subjectEmail;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fulfilment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* ── Right of access ───────────────────────────────────────── */}
          {requestType === "access" && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="dsr-identity-verified"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <ShieldCheck
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Identity verified
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Required before personal data can be disclosed.
                  </p>
                </div>
                <Switch
                  id="dsr-identity-verified"
                  checked={!!dsr.identityVerified}
                  disabled={verifyIdentity.isPending}
                  onCheckedChange={handleVerifyToggle}
                  aria-label="Mark the data subject's identity as verified"
                />
              </div>

              {subjectEmail ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Mail
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    A secure download link will be emailed to{" "}
                    <span className="font-medium text-foreground">
                      {subjectEmail}
                    </span>{" "}
                    (expires in 7 days).
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    This visitor has no email on file, so the export can&apos;t
                    be delivered. Add an email to their profile first.
                  </span>
                </p>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block w-full">
                    <LoadingButton
                      type="button"
                      onClick={handleAccess}
                      isLoading={fulfilAccess.isPending}
                      loadingText="Preparing export…"
                      disabled={!accessReady}
                      className="w-full"
                    >
                      <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
                      Generate &amp; email data export
                    </LoadingButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Gather everything held about this visitor, package it, and
                  email them a secure download link.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* ── Correction ────────────────────────────────────────────── */}
          {requestType === "correction" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Update the visitor&apos;s details. Only changed fields are
                applied; the before/after is recorded on the request.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dsr-correct-name">Full name</Label>
                  <Input
                    id="dsr-correct-name"
                    value={correction.fullName ?? ""}
                    onChange={(e) =>
                      setCorrection((c) => ({ ...c, fullName: e.target.value }))
                    }
                    className="text-base md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dsr-correct-phone">Phone</Label>
                  <Input
                    id="dsr-correct-phone"
                    inputMode="tel"
                    value={correction.phone ?? ""}
                    onChange={(e) =>
                      setCorrection((c) => ({ ...c, phone: e.target.value }))
                    }
                    className="text-base md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dsr-correct-email">Email</Label>
                  <Input
                    id="dsr-correct-email"
                    type="email"
                    inputMode="email"
                    value={correction.emailAddress ?? ""}
                    onChange={(e) =>
                      setCorrection((c) => ({
                        ...c,
                        emailAddress: e.target.value,
                      }))
                    }
                    className="text-base md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dsr-correct-company">Company</Label>
                  <Input
                    id="dsr-correct-company"
                    value={correction.company ?? ""}
                    onChange={(e) =>
                      setCorrection((c) => ({ ...c, company: e.target.value }))
                    }
                    className="text-base md:text-sm"
                  />
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block w-full">
                    <LoadingButton
                      type="button"
                      onClick={handleCorrection}
                      isLoading={fulfilCorrection.isPending}
                      loadingText="Applying…"
                      className="w-full"
                    >
                      <UserCog className="mr-2 h-4 w-4" aria-hidden="true" />
                      Apply correction &amp; complete
                    </LoadingButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Save the corrected details to the visitor profile and close
                  the request.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* ── Consent withdrawal ────────────────────────────────────── */}
          {requestType === "consent_withdrawal" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Opts {subjectName} out of profiling and marks every consent
                record and visit session as withdrawn.
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConsentConfirm(true)}
                    className="w-full min-h-[44px]"
                  >
                    <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
                    Withdraw consent &amp; disable profiling
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Revoke this visitor&apos;s consent and turn off profiling for
                  their profile.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* ── Deletion ──────────────────────────────────────────────── */}
          {requestType === "deletion" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Soft-deletes {subjectName}&apos;s profile now and schedules
                permanent, irreversible deletion in 14 days. Restorable from
                the scheduled-erasures queue until then.
              </p>
              {canErase ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeletionConfirm(true)}
                      className="w-full min-h-[44px]"
                    >
                      <AlertTriangle
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Fulfil erasure
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Erase this visitor&apos;s data and close the request.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You don&apos;t have permission to erase visitor data.
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* ── Shared workflow ───────────────────────────────────────── */}
          <div className="flex flex-col gap-2 sm:flex-row">
            {dsr.status === "pending" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block w-full sm:w-auto">
                    <LoadingButton
                      type="button"
                      variant="outline"
                      onClick={handleAcknowledge}
                      isLoading={acknowledge.isPending}
                      loadingText="Acknowledging…"
                      className="w-full sm:w-auto"
                    >
                      <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      Acknowledge
                    </LoadingButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Mark this request as in progress.
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRejectOpen(true)}
                  className="w-full min-h-[44px] text-destructive hover:text-destructive sm:w-auto"
                >
                  <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Reject this request with a documented reason.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* ── Reject modal ────────────────────────────────────────────── */}
      <ResponsiveModal
        open={rejectOpen}
        onOpenChange={(open) => {
          if (reject.isPending) return;
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
        title={`Reject request from ${subjectName}`}
        description="Document why this request is being rejected. The reason is stored on the request for your compliance trail."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dsr-detail-reject-reason">Reason</Label>
            <Textarea
              id="dsr-detail-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Could not verify the requester's identity"
              rows={3}
              disabled={reject.isPending}
              className="text-base md:text-sm"
            />
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={reject.isPending}
              className="w-full min-h-[44px] md:w-auto"
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              onClick={handleReject}
              isLoading={reject.isPending}
              loadingText="Rejecting…"
              variant="destructive"
              className="w-full md:w-auto"
            >
              Reject request
            </LoadingButton>
          </div>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={consentConfirm}
        onOpenChange={(open) => {
          if (fulfilConsent.isPending) return;
          setConsentConfirm(open);
        }}
        title="Withdraw consent?"
        description={`This opts ${subjectName} out of profiling and marks their consent records withdrawn. The request will be completed.`}
        confirmLabel="Withdraw consent"
        variant="destructive"
        isLoading={fulfilConsent.isPending}
        onConfirm={handleConsent}
      />

      <ConfirmDialog
        open={deletionConfirm}
        onOpenChange={(open) => {
          if (fulfilDeletion.isPending) return;
          setDeletionConfirm(open);
        }}
        title="Erase this visitor's data?"
        description={`This soft-deletes ${subjectName}'s profile now and schedules permanent, irreversible deletion in 14 days. You can restore it from "Scheduled erasures" until then. The request will be completed.`}
        confirmLabel="Erase data"
        variant="destructive"
        isLoading={fulfilDeletion.isPending}
        onConfirm={handleDeletion}
      />
    </>
  );
}
