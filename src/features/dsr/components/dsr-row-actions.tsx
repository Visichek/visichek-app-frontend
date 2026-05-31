"use client";

/**
 * Per-row actions for a data subject request: edit, the acknowledge →
 * complete → reject workflow transitions, and — for `deletion`-type
 * requests — "Fulfil erasure", which erases the linked visitor profile
 * (soft-delete + scheduled permanent deletion) and closes the request out.
 *
 * Each destructive / documented action manages its own dialog so the parent
 * table stays declarative. Mutations invalidate the `["dsr"]` cache, so the
 * row re-renders with its new status on the next read.
 */

import { useState } from "react";
import {
  Check,
  Edit2,
  Loader2,
  MoreHorizontal,
  PlayCircle,
  ShieldOff,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import {
  useAcknowledgeDSR,
  useCompleteDSR,
  useRejectDSR,
} from "@/features/dsr/hooks/use-dsr";
import { useEraseVisitorProfile } from "@/features/dsr/hooks/use-visitor-erasure";
import type { DataSubjectRequest } from "@/types/dpo";

/** Mirrors the backend grace window (`ERASURE_GRACE_SECONDS`). */
const ERASURE_GRACE_DAYS = 14;

export function DSRRowActions({ dsr }: { dsr: DataSubjectRequest }) {
  const { hasCapability } = useCapabilities();
  const canEdit = hasCapability(CAPABILITIES.DSR_EDIT);
  const canErase = hasCapability(CAPABILITIES.VISITOR_ERASE);

  const acknowledge = useAcknowledgeDSR();
  const complete = useCompleteDSR();
  const reject = useRejectDSR();
  const erase = useEraseVisitorProfile();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [eraseOpen, setEraseOpen] = useState(false);

  // Backend emits `requestType`; tolerate the legacy `type` defensively.
  const requestType = dsr.requestType ?? dsr.type;
  const subjectName =
    dsr.visitorProfileSummary?.fullName || dsr.requesterName || "this visitor";

  const isClosed = dsr.status === "completed" || dsr.status === "rejected";
  const canFulfilErasure =
    canErase && requestType === "deletion" && !!dsr.visitorProfileId && !isClosed;

  const busy =
    acknowledge.isPending ||
    complete.isPending ||
    reject.isPending ||
    erase.isPending;

  // A DPO with no edit capability and nothing to erase has no actions to
  // show — don't render an empty, dead trigger.
  const hasAnyAction = canEdit || canFulfilErasure;
  if (!hasAnyAction) return null;

  async function handleAcknowledge() {
    try {
      await acknowledge.mutateAsync(dsr.id);
      toast.success("Request acknowledged — now in progress");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to acknowledge request",
      );
    }
  }

  async function handleComplete() {
    try {
      await complete.mutateAsync({ dsrId: dsr.id });
      toast.success("Request marked as completed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to complete request",
      );
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
      toast.error(
        err instanceof Error ? err.message : "Failed to reject request",
      );
    }
  }

  async function handleErasure() {
    if (!dsr.visitorProfileId) return;
    try {
      await erase.mutateAsync({
        profileId: dsr.visitorProfileId,
        reason: `DSR ${dsr.id} — data subject erasure request`,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to erase visitor data",
      );
      return;
    }
    // Data is scheduled for deletion — now close the request out. If only the
    // status update fails, the erasure already succeeded, so surface a softer
    // note rather than an error and let the DPO complete it manually.
    try {
      await complete.mutateAsync({
        dsrId: dsr.id,
        resolution: `Visitor data erased — permanent deletion scheduled in ${ERASURE_GRACE_DAYS} days.`,
      });
      toast.success(
        `Visitor data erased — permanent deletion scheduled in ${ERASURE_GRACE_DAYS} days`,
      );
    } catch {
      toast(
        "Visitor data erased. Couldn't update the request status — mark it completed manually.",
      );
    }
    setEraseOpen(false);
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
        <DropdownMenuContent align="end" className="w-52">
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
          {canEdit && dsr.status === "in_progress" && (
            <DropdownMenuItem onClick={handleComplete}>
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              Mark completed
            </DropdownMenuItem>
          )}
          {canFulfilErasure && (
            <>
              {canEdit && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => setEraseOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
                Fulfil erasure
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

      <ConfirmDialog
        open={eraseOpen}
        onOpenChange={(open) => {
          if (erase.isPending || complete.isPending) return;
          setEraseOpen(open);
        }}
        title="Erase this visitor's data?"
        description={`This soft-deletes ${subjectName}'s visitor profile now and schedules permanent, irreversible deletion in ${ERASURE_GRACE_DAYS} days. You can restore it from "Scheduled erasures" until then. The request will be marked completed.`}
        confirmLabel="Erase data"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={erase.isPending || complete.isPending}
        onConfirm={handleErasure}
      />
    </>
  );
}
