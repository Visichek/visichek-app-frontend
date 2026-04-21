"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Printer,
  Download,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { ApiError } from "@/types/api";
import {
  isCheckinApproveResponse,
  type CheckinConfirmAction,
  type CheckinOut,
} from "@/types/checkin";
import { CheckinStateBadge } from "./state-badge";
import { useConfirmCheckin } from "../hooks";
import { formatDateTime } from "@/lib/utils/format-date";

interface ConfirmCheckinFormProps {
  checkin: CheckinOut;
  defaultAction: CheckinConfirmAction;
}

interface BadgeState {
  pdfBase64?: string;
  qrToken: string;
  visitorName: string;
}

function base64ToBlob(base64: string, mime: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}

function downloadBadgePdf(base64: string, visitorName: string) {
  const blob = base64ToBlob(base64, "application/pdf");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `badge-${
    visitorName.replace(/\s+/g, "-").toLowerCase() || "visitor"
  }.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printBadgePdf(base64: string) {
  const blob = base64ToBlob(base64, "application/pdf");
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Dedicated page-level form for approving or rejecting a check-in.
 *
 * Replaces the modal at src/features/checkins/components/confirm-checkin-modal.tsx.
 * The default action comes from the `?action=approve|reject` query param but
 * the user can flip the choice inside the form. Reject requires a reason.
 *
 * On approve, the successful response includes a badge payload which is shown
 * inline on this page as a result panel — receptionists can print or download
 * the PDF without navigating away.
 */
export function ConfirmCheckinForm({
  checkin,
  defaultAction,
}: ConfirmCheckinFormProps) {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const confirmMutation = useConfirmCheckin();

  const [action, setAction] = useState<CheckinConfirmAction>(defaultAction);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<BadgeState | null>(null);

  const visitorName = checkin.visitor?.fullName || "Visitor";
  const isPending = checkin.state === "pending_approval";

  async function handleSubmit() {
    setError(null);

    if (action === "reject" && notes.trim().length < 3) {
      setError(
        "Please give a short reason so the visitor's host knows why.",
      );
      return;
    }

    try {
      const response = await confirmMutation.mutateAsync({
        checkinId: checkin.id,
        action,
        notes: notes.trim() || undefined,
      });

      if (action === "approve") {
        toast.success(`${visitorName} checked in. Badge ready to print.`);
        if (isCheckinApproveResponse(response)) {
          setBadge({
            pdfBase64: response.badge.badgePdfBase64,
            qrToken: response.badge.badgeQrToken,
            visitorName,
          });
          return;
        }
        router.push("/app/visitors");
      } else {
        toast.info(`${visitorName} rejected. Host has been notified.`);
        router.push("/app/visitors");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't update the check-in. Please try again.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/visitors"
                onClick={() => handleNavClick("/app/visitors")}
              >
                {loadingHref === "/app/visitors" ? (
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
                Back to visitors
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the visitors list without making a decision
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={action === "approve" ? "Approve check-in" : "Reject check-in"}
        description={`${visitorName} is waiting for a decision.`}
      />

      {/* Visitor snapshot */}
      <section className="rounded-lg border p-4 space-y-3 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {checkin.visitor?.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={checkin.visitor.portraitUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover border"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{visitorName}</p>
              {checkin.visitor?.email && (
                <p className="text-sm text-muted-foreground truncate">
                  {checkin.visitor.email}
                </p>
              )}
              {checkin.visitor?.phone && (
                <p className="text-sm text-muted-foreground truncate">
                  {checkin.visitor.phone}
                </p>
              )}
            </div>
          </div>
          <CheckinStateBadge state={checkin.state} />
        </div>

        <div className="text-sm">
          <p className="font-medium">Purpose</p>
          <p className="text-muted-foreground">{checkin.purpose.purpose}</p>
          {checkin.purpose.purposeDetails && (
            <p className="text-muted-foreground whitespace-pre-wrap mt-1">
              {checkin.purpose.purposeDetails}
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Submitted {formatDateTime(checkin.dateCreated)}
        </p>
      </section>

      {badge ? (
        // Approved result — show the badge actions inline.
        <section
          className="rounded-lg border p-4 space-y-4 bg-success/5"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <p className="font-medium">
              {badge.visitorName} checked in
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Print or download their badge now, or head back — you can always
            fetch the badge later from the check-in details.
          </p>
          <div className="flex flex-col gap-2 md:flex-row">
            {badge.pdfBase64 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() =>
                        badge.pdfBase64 && printBadgePdf(badge.pdfBase64)
                      }
                      className="min-h-[44px]"
                    >
                      <Printer
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Print badge
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Open the badge PDF and send it to your printer
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() =>
                        badge.pdfBase64 &&
                        downloadBadgePdf(badge.pdfBase64, badge.visitorName)
                      }
                      className="min-h-[44px]"
                    >
                      <Download
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Download PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Save the badge as a PDF to your computer
                  </TooltipContent>
                </Tooltip>
              </>
            )}
            {!badge.pdfBase64 && badge.qrToken && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(badge.qrToken)
                        .then(() => toast.success("Token copied"))
                        .catch(() =>
                          toast.error("Couldn't copy to clipboard"),
                        );
                    }}
                    className="min-h-[44px]"
                  >
                    <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                    Copy badge token
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Copy the badge QR token to share or paste into another system
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  asChild
                  className="min-h-[44px] md:ml-auto"
                >
                  <Link
                    href="/app/visitors"
                    onClick={() => handleNavClick("/app/visitors")}
                  >
                    Done
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Return to the visitors list
              </TooltipContent>
            </Tooltip>
          </div>
        </section>
      ) : (
        // Decision form.
        <section className="space-y-5">
          {!isPending && (
            <p
              className="text-sm rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning-foreground"
              role="alert"
            >
              This check-in is no longer pending — it&apos;s currently{" "}
              <strong>{checkin.state.replace(/_/g, " ")}</strong>. Submitting
              here may fail on the server.
            </p>
          )}

          <div className="space-y-2">
            <Label>Decision</Label>
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
                    <CheckCircle2
                      className="mr-1.5 h-4 w-4"
                      aria-hidden="true"
                    />
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
                    <XCircle
                      className="mr-1.5 h-4 w-4"
                      aria-hidden="true"
                    />
                    Reject
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Deny this visitor entry and notify their host with a reason
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="space-y-2">
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
              className="text-base md:text-sm min-h-[120px]"
              disabled={confirmMutation.isPending}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={confirmMutation.isPending}
                  className="w-full min-h-[44px] md:w-auto"
                >
                  <Link
                    href="/app/visitors"
                    onClick={() => handleNavClick("/app/visitors")}
                  >
                    Cancel
                  </Link>
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
                    {action === "approve"
                      ? "Approve check-in"
                      : "Reject check-in"}
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
        </section>
      )}
    </div>
  );
}
