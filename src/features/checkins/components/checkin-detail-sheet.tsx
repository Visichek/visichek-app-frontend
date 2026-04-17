"use client";

import { CheckCircle2, XCircle, ShieldCheck, User, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckinStateBadge } from "./state-badge";
import { formatDateTime } from "@/lib/utils/format-date";
import type { CheckinOut } from "@/types/checkin";

interface CheckinDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: CheckinOut | null;
  onApprove: (checkin: CheckinOut) => void;
  onReject: (checkin: CheckinOut) => void;
}

/**
 * Read-only detail view for a single check-in, with inline approve /
 * reject actions when the check-in is pending. Opens as a right-anchored
 * sheet on desktop and a bottom drawer on mobile (Sheet auto-sizes).
 */
export function CheckinDetailSheet({
  open,
  onOpenChange,
  checkin,
  onApprove,
  onReject,
}: CheckinDetailSheetProps) {
  if (!checkin) return null;

  const visitorName = checkin.visitor?.fullName || "Visitor";
  const isPending = checkin.state === "pending_approval";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{visitorName}</SheetTitle>
          <SheetDescription>Check-in details</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <CheckinStateBadge state={checkin.state} />
            {checkin.verified && (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                ID verified
              </span>
            )}
          </div>

          {/* Visitor */}
          {checkin.visitor && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Visitor
              </h3>
              <div className="flex items-start gap-3">
                {checkin.visitor.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={checkin.visitor.portraitUrl}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <User
                      className="h-6 w-6 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{visitorName}</p>
                  {checkin.visitor.email && (
                    <p className="text-sm text-muted-foreground truncate">
                      {checkin.visitor.email}
                    </p>
                  )}
                  {checkin.visitor.phone && (
                    <p className="text-sm text-muted-foreground">
                      {checkin.visitor.phone}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          <Separator />

          {/* Purpose */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Purpose
            </h3>
            <p className="text-sm">{checkin.purpose.purpose}</p>
            {checkin.purpose.purposeDetails && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {checkin.purpose.purposeDetails}
              </p>
            )}
            {checkin.purpose.expectedDurationMinutes && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Expected: {checkin.purpose.expectedDurationMinutes} min
              </p>
            )}
          </section>

          {/* Tenant-specific data */}
          {Object.keys(checkin.tenantSpecificData).length > 0 && (
            <>
              <Separator />
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Additional details
                </h3>
                <dl className="grid grid-cols-1 gap-2 text-sm">
                  {Object.entries(checkin.tenantSpecificData).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </dt>
                        <dd className="text-right">{String(value)}</dd>
                      </div>
                    )
                  )}
                </dl>
              </section>
            </>
          )}

          <Separator />

          {/* Timeline */}
          <section className="space-y-1 text-xs text-muted-foreground">
            <p>Submitted {formatDateTime(checkin.dateCreated)}</p>
            {checkin.approvedAt && (
              <p>
                {checkin.state === "approved" ? "Approved" : "Actioned"}{" "}
                {formatDateTime(checkin.approvedAt)}
              </p>
            )}
            {checkin.rejectionReason && (
              <p className="text-destructive">
                Reason: {checkin.rejectionReason}
              </p>
            )}
          </section>

          {/* Actions */}
          {isPending && (
            <div className="flex flex-col gap-2 pt-2 border-t">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onApprove(checkin)}
                    className="min-h-[44px]"
                  >
                    <CheckCircle2
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                    Approve check-in
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Let this visitor in and issue a badge
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    onClick={() => onReject(checkin)}
                    className="min-h-[44px]"
                  >
                    <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                    Reject check-in
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Deny this visitor entry and notify their host
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
