"use client";

/**
 * Per-row actions for a data subject request. Covers the shared workflow
 * (edit, acknowledge → complete → reject) AND the type-specific fulfilment
 * each request needs, so a DPO can action a request straight from the list
 * without opening its detail page:
 *
 *   access              → "Send data export"  (verify identity, gather + email)
 *   consent_withdrawal  → "Withdraw consent"   (opt out of profiling)
 *   correction          → "Apply correction"   (allowlisted profile edits)
 *   deletion            → "Fulfil erasure"      (soft-delete + 14-day purge)
 *
 * Each destructive / input-bearing action manages its own dialog. Mutations
 * auto-poll the queued job to terminal and invalidate the `["dsr"]` cache, so
 * the row re-renders with its new status on the next read.
 */

import { useState } from "react";
import {
  Ban,
  Check,
  Edit2,
  Eye,
  FileDown,
  Loader2,
  MoreHorizontal,
  PlayCircle,
  ShieldOff,
  UserCog,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import {
  useAcknowledgeDSR,
  useCompleteDSR,
  useFulfilAccessDSR,
  useFulfilConsentWithdrawalDSR,
  useFulfilCorrectionDSR,
  useFulfilDeletionDSR,
  useRejectDSR,
  useVerifyDSRIdentity,
} from "@/features/dsr/hooks/use-dsr";
import type { DataSubjectRequest, DSRCorrectionRequest } from "@/types/dpo";

/** Mirrors the backend grace window (`ERASURE_GRACE_SECONDS`). */
const ERASURE_GRACE_DAYS = 14;

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function DSRRowActions({ dsr }: { dsr: DataSubjectRequest }) {
  const { hasCapability } = useCapabilities();
  const canEdit = hasCapability(CAPABILITIES.DSR_EDIT);
  const canErase = hasCapability(CAPABILITIES.VISITOR_ERASE);

  const acknowledge = useAcknowledgeDSR();
  const complete = useCompleteDSR();
  const reject = useRejectDSR();
  const verifyIdentity = useVerifyDSRIdentity(dsr.id);
  const fulfilAccess = useFulfilAccessDSR(dsr.id);
  const fulfilConsent = useFulfilConsentWithdrawalDSR(dsr.id);
  const fulfilCorrection = useFulfilCorrectionDSR(dsr.id);
  const fulfilDeletion = useFulfilDeletionDSR(dsr.id);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState<DSRCorrectionRequest>({
    fullName: dsr.visitorProfileSummary?.fullName ?? "",
    phone: dsr.visitorProfileSummary?.phone ?? "",
    emailAddress: dsr.visitorProfileSummary?.emailAddress ?? "",
    company: dsr.visitorProfileSummary?.company ?? "",
  });

  // Backend emits `requestType`; tolerate the legacy `type` defensively.
  const requestType = dsr.requestType ?? dsr.type;
  const subjectName =
    dsr.visitorProfileSummary?.fullName || dsr.requesterName || "this visitor";
  const accessRecipients = Array.from(
    new Set(
      [dsr.requesterEmail, dsr.visitorProfileSummary?.emailAddress].filter(
        (e): e is string => !!e && e.includes("@"),
      ),
    ),
  );

  const isClosed = dsr.status === "completed" || dsr.status === "rejected";
  const showAccess = canEdit && requestType === "access" && !isClosed;
  const showConsent =
    canEdit && requestType === "consent_withdrawal" && !isClosed;
  const showCorrection = canEdit && requestType === "correction" && !isClosed;
  const showDeletion =
    canEdit &&
    canErase &&
    requestType === "deletion" &&
    !!dsr.visitorProfileId &&
    !isClosed;

  const busy =
    acknowledge.isPending ||
    complete.isPending ||
    reject.isPending ||
    verifyIdentity.isPending ||
    fulfilAccess.isPending ||
    fulfilConsent.isPending ||
    fulfilCorrection.isPending ||
    fulfilDeletion.isPending;

  // A user with no edit capability and nothing to erase has no actions — don't
  // render an empty, dead trigger.
  const hasAnyAction = canEdit || showDeletion;
  if (!hasAnyAction) return null;

  async function handleAcknowledge() {
    try {
      await acknowledge.mutateAsync(dsr.id);
      toast.success("Request acknowledged — now in progress");
    } catch (err) {
      toast.error(errMessage(err, "Failed to acknowledge request"));
    }
  }

  async function handleComplete() {
    try {
      await complete.mutateAsync({ dsrId: dsr.id });
      toast.success("Request marked as completed");
    } catch (err) {
      toast.error(errMessage(err, "Failed to complete request"));
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
      toast.error(errMessage(err, "Failed to reject request"));
    }
  }

  async function handleAccess() {
    try {
      // The confirm dialog is the DPO's identity-verification attestation, so
      // flip the flag (if not already set) before generating the export.
      if (!dsr.identityVerified) {
        await verifyIdentity.mutateAsync(true);
      }
      await fulfilAccess.mutateAsync();
      toast.success(
        `Data export generated and emailed to ${accessRecipients.join(", ")}`,
      );
      setAccessOpen(false);
    } catch (err) {
      toast.error(errMessage(err, "Couldn't generate the data export"));
    }
  }

  async function handleConsent() {
    try {
      await fulfilConsent.mutateAsync();
      toast.success("Consent withdrawn and profiling disabled");
      setConsentOpen(false);
    } catch (err) {
      toast.error(errMessage(err, "Couldn't withdraw consent"));
    }
  }

  async function handleDeletion() {
    try {
      await fulfilDeletion.mutateAsync();
      toast.success(
        `Erasure scheduled — permanent deletion in ${ERASURE_GRACE_DAYS} days`,
      );
      setDeletionOpen(false);
    } catch (err) {
      toast.error(errMessage(err, "Couldn't schedule the erasure"));
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
      setCorrectionOpen(false);
    } catch (err) {
      toast.error(errMessage(err, "Couldn't apply the correction"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            Open actions for this data subject request
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          {canEdit && (
            <DropdownMenuNavItem
              href={`/app/dpo/requests/${dsr.id}`}
              label="Open details"
              icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            />
          )}
          {canEdit && (
            <DropdownMenuNavItem
              href={`/app/dpo/requests/${dsr.id}/edit`}
              label="Edit"
              icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
            />
          )}
          {canEdit && dsr.status === "pending" && (
            <DropdownMenuItem onClick={handleAcknowledge}>
              <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Acknowledge
            </DropdownMenuItem>
          )}

          {/* Type-specific fulfilment */}
          {(showAccess || showConsent || showCorrection || showDeletion) && (
            <DropdownMenuSeparator />
          )}
          {showAccess && (
            <DropdownMenuItem onClick={() => setAccessOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
              Send data export
            </DropdownMenuItem>
          )}
          {showConsent && (
            <DropdownMenuItem onClick={() => setConsentOpen(true)}>
              <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
              Withdraw consent
            </DropdownMenuItem>
          )}
          {showCorrection && (
            <DropdownMenuItem onClick={() => setCorrectionOpen(true)}>
              <UserCog className="mr-2 h-4 w-4" aria-hidden="true" />
              Apply correction
            </DropdownMenuItem>
          )}
          {showDeletion && (
            <DropdownMenuItem
              onClick={() => setDeletionOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
              Fulfil erasure
            </DropdownMenuItem>
          )}

          {/* Generic completion for requests handled manually (e.g. correction
              done out-of-band) + reject. */}
          {canEdit && dsr.status === "in_progress" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleComplete}>
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                Mark completed
              </DropdownMenuItem>
            </>
          )}
          {canEdit && !isClosed && (
            <DropdownMenuItem
              onClick={() => setRejectOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Reject
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reject reason */}
      <ResponsiveModal
        open={rejectOpen}
        onOpenChange={(open) => {
          if (reject.isPending) return;
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
        title={`Reject request from ${subjectName}`}
        description="Document why this data subject request is being rejected. The reason is stored on the request for your compliance trail."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dsr-reject-reason">Reason</Label>
            <Textarea
              id="dsr-reject-reason"
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

      {/* Correction form */}
      <ResponsiveModal
        open={correctionOpen}
        onOpenChange={(open) => {
          if (fulfilCorrection.isPending) return;
          setCorrectionOpen(open);
        }}
        title={`Correct ${subjectName}'s details`}
        description="Only changed fields are applied to the visitor profile; the before/after is recorded on the request, which is then completed."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dsr-row-correct-name">Full name</Label>
              <Input
                id="dsr-row-correct-name"
                value={correction.fullName ?? ""}
                onChange={(e) =>
                  setCorrection((c) => ({ ...c, fullName: e.target.value }))
                }
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dsr-row-correct-phone">Phone</Label>
              <Input
                id="dsr-row-correct-phone"
                inputMode="tel"
                value={correction.phone ?? ""}
                onChange={(e) =>
                  setCorrection((c) => ({ ...c, phone: e.target.value }))
                }
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dsr-row-correct-email">Email</Label>
              <Input
                id="dsr-row-correct-email"
                type="email"
                inputMode="email"
                value={correction.emailAddress ?? ""}
                onChange={(e) =>
                  setCorrection((c) => ({ ...c, emailAddress: e.target.value }))
                }
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dsr-row-correct-company">Company</Label>
              <Input
                id="dsr-row-correct-company"
                value={correction.company ?? ""}
                onChange={(e) =>
                  setCorrection((c) => ({ ...c, company: e.target.value }))
                }
                className="text-base md:text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCorrectionOpen(false)}
              disabled={fulfilCorrection.isPending}
              className="w-full min-h-[44px] md:w-auto"
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              onClick={handleCorrection}
              isLoading={fulfilCorrection.isPending}
              loadingText="Applying…"
              className="w-full md:w-auto"
            >
              Apply &amp; complete
            </LoadingButton>
          </div>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={accessOpen}
        onOpenChange={(open) => {
          if (fulfilAccess.isPending || verifyIdentity.isPending) return;
          setAccessOpen(open);
        }}
        title="Send the data export?"
        description={
          accessRecipients.length > 0
            ? `Confirms ${subjectName}'s identity is verified, then gathers their data and emails a secure 7-day download link to ${accessRecipients.join(
                ", ",
              )}.`
            : `There's no email on file for the requester or ${subjectName}'s profile, so the export can't be delivered. Add an email to the visitor profile first.`
        }
        confirmLabel="Verify & send"
        variant="default"
        isLoading={fulfilAccess.isPending || verifyIdentity.isPending}
        onConfirm={() => {
          if (accessRecipients.length === 0) {
            toast.error("No email on file to deliver the export");
            return;
          }
          void handleAccess();
        }}
      />

      <ConfirmDialog
        open={consentOpen}
        onOpenChange={(open) => {
          if (fulfilConsent.isPending) return;
          setConsentOpen(open);
        }}
        title="Withdraw consent?"
        description={`Opts ${subjectName} out of profiling and marks their consent records withdrawn. The request will be completed.`}
        confirmLabel="Withdraw consent"
        variant="destructive"
        isLoading={fulfilConsent.isPending}
        onConfirm={handleConsent}
      />

      <ConfirmDialog
        open={deletionOpen}
        onOpenChange={(open) => {
          if (fulfilDeletion.isPending) return;
          setDeletionOpen(open);
        }}
        title="Erase this visitor's data?"
        description={`This soft-deletes ${subjectName}'s visitor profile now and schedules permanent, irreversible deletion in ${ERASURE_GRACE_DAYS} days. You can restore it from "Scheduled erasures" until then. The request will be marked completed.`}
        confirmLabel="Erase data"
        variant="destructive"
        isLoading={fulfilDeletion.isPending}
        onConfirm={handleDeletion}
      />
    </>
  );
}
