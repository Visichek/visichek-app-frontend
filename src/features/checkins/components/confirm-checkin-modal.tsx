"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApiError } from "@/types/api";
import {
  isCheckinApproveResponse,
  type CheckinConfirmAction,
} from "@/types/checkin";
import { useConfirmCheckin } from "../hooks";

interface ConfirmCheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkinId: string;
  visitorName: string;
  /** Default action when the modal opens. */
  defaultAction: CheckinConfirmAction;
  /** Called with the approved badge payload so the caller can print. */
  onApproved?: (badge: {
    badgeQrToken: string;
    badgePdfBase64?: string;
  }) => void;
}

/**
 * Approve or reject a pending check-in.
 *
 * The modal is dual-purpose: the default action is set by the caller
 * (from which button the receptionist clicked), but they can flip it
 * inside the modal. Reject requires a reason ≥ 3 chars.
 */
export function ConfirmCheckinModal({
  open,
  onOpenChange,
  checkinId,
  visitorName,
  defaultAction,
  onApproved,
}: ConfirmCheckinModalProps) {
  const [action, setAction] = useState<CheckinConfirmAction>(defaultAction);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirmMutation = useConfirmCheckin();

  async function handleSubmit() {
    setError(null);

    if (action === "reject" && notes.trim().length < 3) {
      setError(
        "Please give a short reason so the visitor's host knows why."
      );
      return;
    }

    try {
      const response = await confirmMutation.mutateAsync({
        checkinId,
        action,
        notes: notes.trim() || undefined,
      });

      if (action === "approve") {
        toast.success(`${visitorName} checked in. Badge ready to print.`);
        if (isCheckinApproveResponse(response)) {
          onApproved?.(response.badge);
        }
      } else {
        toast.info(`${visitorName} rejected. Host has been notified.`);
      }
      onOpenChange(false);
      setNotes("");
      setAction(defaultAction);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't update the check-in. Please try again."
      );
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setNotes("");
          setError(null);
          setAction(defaultAction);
        }
        onOpenChange(next);
      }}
      title={action === "approve" ? "Approve check-in" : "Reject check-in"}
      description={`${visitorName} is waiting for a decision.`}
    >
      <div className="space-y-4">
        {/* Action toggle */}
        <div
          className="inline-flex rounded-md border p-0.5 bg-muted/40"
          role="tablist"
          aria-label="Approve or reject"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                role="tab"
                aria-selected={action === "approve"}
                variant={action === "approve" ? "default" : "ghost"}
                size="sm"
                onClick={() => setAction("approve")}
                className="min-h-[44px]"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Let this visitor in and issue a badge
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                role="tab"
                aria-selected={action === "reject"}
                variant={action === "reject" ? "destructive" : "ghost"}
                size="sm"
                onClick={() => setAction("reject")}
                className="min-h-[44px]"
              >
                <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Reject
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Deny this visitor entry and notify their host with a reason
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-notes" className="text-sm">
            {action === "approve" ? "Notes (optional)" : "Reason"}
            {action === "reject" && (
              <span className="text-destructive ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </Label>
          <Textarea
            id="confirm-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              action === "approve"
                ? "Any internal note for the audit log"
                : "e.g. Could not verify ID; please reschedule."
            }
            className="text-base md:text-sm min-h-[100px]"
            disabled={confirmMutation.isPending}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse md:flex-row gap-2 md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={confirmMutation.isPending}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Close without changing the check-in
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  onClick={handleSubmit}
                  isLoading={confirmMutation.isPending}
                  loadingText={
                    action === "approve" ? "Approving…" : "Rejecting…"
                  }
                  variant={action === "reject" ? "destructive" : "default"}
                  className="w-full md:w-auto"
                >
                  {action === "approve" ? "Approve check-in" : "Reject check-in"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {action === "approve"
                ? "Confirm this check-in and issue the visitor a badge"
                : "Deny this check-in and send the reason to the visitor's host"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </ResponsiveModal>
  );
}
