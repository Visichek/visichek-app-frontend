"use client";

/**
 * Confirmation dialog for manually verifying a visitor's identity from the
 * receptionist / admin visitors list.
 *
 * Backed by `useManuallyVerifyCheckin` →
 * `POST /v1/checkins/{checkinId}/manual-verify` (PROPOSED endpoint — see
 * `backend-contract-manual-verify-and-edit-visitor.txt`). This is an attestation:
 * the signed-in staff member confirms they physically checked the
 * visitor's ID. The verifier identity is recorded server-side from the
 * auth token; only the optional note travels in the body.
 */

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useManuallyVerifyCheckin } from "@/features/checkins/hooks";

const NOTE_MAX = 500;

export interface ManualVerifyTarget {
  checkinId: string;
  visitorName: string;
}

interface ManualVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ManualVerifyTarget | null;
}

export function ManualVerifyDialog({
  open,
  onOpenChange,
  target,
}: ManualVerifyDialogProps) {
  const manualVerify = useManuallyVerifyCheckin();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  async function handleConfirm() {
    if (!target) return;
    const trimmed = note.trim();
    try {
      await manualVerify.mutateAsync({
        checkinId: target.checkinId,
        notes: trimmed.length > 0 ? trimmed : undefined,
      });
      toast.success(`${target.visitorName || "Visitor"} marked as verified`);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to verify visitor",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && manualVerify.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
            Verify {target?.visitorName || "visitor"}
          </DialogTitle>
          <DialogDescription>
            Confirm you have physically checked this visitor&apos;s ID. This
            marks them as verified and records that you vouched for their
            identity — your name and role are saved on the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="manual-verify-note">Note (optional)</Label>
          <Textarea
            id="manual-verify-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            placeholder="e.g. Checked national ID card against the visitor in person"
            rows={3}
            disabled={manualVerify.isPending}
          />
          <p className="text-xs text-muted-foreground text-right">
            {note.length}/{NOTE_MAX}
          </p>
        </div>

        <DialogFooter>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={manualVerify.isPending}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Close without verifying this visitor
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="button"
                  onClick={handleConfirm}
                  isLoading={manualVerify.isPending}
                  loadingText="Verifying…"
                >
                  Confirm verification
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Mark this visitor as identity-verified and record you as the
              verifier
            </TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
