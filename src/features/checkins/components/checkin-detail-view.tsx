"use client";

import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  User,
  Clock,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CheckinStateBadge } from "./state-badge";
import { IdentityCheckBadge } from "./identity-check-badge";
import { formatDateTime } from "@/lib/utils/format-date";
import type { CheckinOut } from "@/types/checkin";

const LIST_HREF = "/app/visitors/pending";

function confirmHref(id: string, action: "approve" | "reject") {
  return `/app/visitors/${id}/confirm?action=${action}`;
}

export interface CheckinDetailViewProps {
  checkin: CheckinOut;
}

/**
 * Read-only detail view for a single check-in, rendered as a full page at
 * `/app/visitors/{id}`. Pending check-ins surface inline approve / reject
 * CTAs that navigate to the confirm flow with the selected action preset.
 */
export function CheckinDetailView({ checkin }: CheckinDetailViewProps) {
  const { loadingHref } = useNavigationLoading();

  const visitorName = checkin.visitor?.fullName || "Visitor";
  const isPending = checkin.state === "pending_approval";
  const approveHref = confirmHref(checkin.id, "approve");
  const rejectHref = confirmHref(checkin.id, "reject");

  const isNavigatingBack = loadingHref === LIST_HREF;
  const isNavigatingApprove = loadingHref === approveHref;
  const isNavigatingReject = loadingHref === rejectHref;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton
              href={LIST_HREF}
              variant="ghost"
              size="sm"
              className="min-h-[44px] -ml-2"
            >
              {isNavigatingBack ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to visitors
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the visitors list
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader title={visitorName} description="Check-in details" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <CheckinStateBadge state={checkin.state} />
          {/* Always rendered — previously this showed nothing at all when the
              visitor was unverified, which is exactly the case the approver
              most needs to see. */}
          <IdentityCheckBadge
            identityCheck={checkin.identityCheck}
            verified={checkin.verified}
          />
        </div>

        {checkin.visitor && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Visitor
            </h2>
            <div className="flex items-start gap-3">
              {checkin.visitor.portraitUrl ? (
                <Image
                  src={checkin.visitor.portraitUrl}
                  alt=""
                  width={64}
                  height={64}
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
                {checkin.visitor.company && (
                  <p className="text-sm text-muted-foreground truncate">
                    {checkin.visitor.company}
                  </p>
                )}
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

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Purpose</h2>
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

        {Object.keys(checkin.tenantSpecificData).length > 0 && (
          <>
            <Separator />
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Additional details
              </h2>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-x-6">
                {Object.entries(checkin.tenantSpecificData).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between gap-4 sm:block sm:space-y-0.5"
                    >
                      <dt className="text-muted-foreground capitalize">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-right sm:text-left">
                        {String(value)}
                      </dd>
                    </div>
                  )
                )}
              </dl>
            </section>
          </>
        )}

        <Separator />

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

        {isPending && (
          <div className="flex flex-col gap-2 pt-2 border-t sm:flex-row">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href={approveHref}
                  className="min-h-[44px] sm:flex-1"
                >
                  {isNavigatingApprove ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  Approve check-in
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="top">
                Let this visitor in and issue a badge
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href={rejectHref}
                  variant="destructive"
                  className="min-h-[44px] sm:flex-1"
                >
                  {isNavigatingReject ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Reject check-in
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="top">
                Deny this visitor entry and notify their host
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
