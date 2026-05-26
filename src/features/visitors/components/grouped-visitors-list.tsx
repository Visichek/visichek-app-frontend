"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Printer,
  Search,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { CheckinStateBadge } from "@/features/checkins";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import type { CheckinOut } from "@/types/checkin";
import type { AwaitingCheckoutItem } from "@/types/visitor";
import { EditVisitorModal, type EditVisitorTarget } from "./edit-visitor-modal";
import {
  ManualVerifyDialog,
  type ManualVerifyTarget,
} from "./manual-verify-dialog";
import { PrintBadgeModal } from "./print-badge-modal";
import type { VisitorBadgeData } from "./visitor-badge";

/** Human label for the verifier's role on the manual-verify attribution line. */
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  dept_admin: "Department admin",
  receptionist: "Receptionist",
  auditor: "Auditor",
  security_officer: "Security officer",
  dpo: "DPO",
};

function roleLabel(role: string | undefined): string | undefined {
  if (!role) return undefined;
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export interface GroupedVisitorsListProps {
  checkins: CheckinOut[];
  emptyTitle: string;
  emptyDescription: string;
  /**
   * Optional map keyed by check-in id of approved-and-not-yet-checked-out
   * entries from `useAwaitingCheckout`. When a row has a matching entry
   * with a badge QR token, the row exposes a "Print badge" action that
   * opens the print/PDF modal with the live checkout token.
   */
  badgeByCheckinId?: Map<string, AwaitingCheckoutItem>;
}

/** Default expiry hint shown on the badge when the backend doesn't supply one. */
const BADGE_DEFAULT_TTL_SECONDS = 12 * 60 * 60;

function buildBadgeData(
  awaiting: AwaitingCheckoutItem,
): Omit<VisitorBadgeData, "tenantName" | "logoUrl" | "primaryColor"> {
  const issuedAt =
    awaiting.approvedAt ??
    awaiting.checkInTime ??
    awaiting.eligibleSince ??
    undefined;
  return {
    visitorName: awaiting.visitorName || "Unnamed visitor",
    company:
      awaiting.company ||
      awaiting.visitorSummary?.company ||
      awaiting.visitorProfileSummary?.company ||
      undefined,
    purpose: awaiting.purpose ?? undefined,
    hostName: awaiting.hostSummary?.name,
    departmentName: awaiting.departmentSummary?.name,
    statusLabel: "Approved",
    badgeQrToken: awaiting.badgeQrToken ?? "",
    issuedAt: issuedAt ?? undefined,
    badgeExpiry:
      issuedAt !== undefined ? issuedAt + BADGE_DEFAULT_TTL_SECONDS : undefined,
  };
}

interface VisitorGroup {
  key: string;
  /**
   * Canonical `visitors` record id, needed to PATCH the profile on edit.
   * Absent only when the embedded `visitor` snapshot was null on every
   * check-in in the group (hard-deleted visitor) — the Edit action hides
   * in that case.
   */
  visitorId?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  portraitUrl?: string;
  verified: boolean;
  visitCount: number;
  lastVisitAt: number;
  history: CheckinOut[];
}

function groupKeyFor(checkin: CheckinOut): string {
  const v = checkin.visitor;
  if (v?.id) return `id:${v.id}`;
  if (v?.email) return `email:${v.email.toLowerCase()}`;
  if (v?.phone) return `phone:${v.phone}`;
  return `checkin:${checkin.id}`;
}

function buildGroups(checkins: CheckinOut[]): VisitorGroup[] {
  const map = new Map<string, VisitorGroup>();

  for (const checkin of checkins) {
    const key = groupKeyFor(checkin);
    const existing = map.get(key);
    if (existing) {
      existing.visitCount += 1;
      existing.history.push(checkin);
      if (checkin.dateCreated > existing.lastVisitAt) {
        existing.lastVisitAt = checkin.dateCreated;
      }
      if (checkin.verified) existing.verified = true;
      if (!existing.visitorId) {
        existing.visitorId = checkin.visitor?.id ?? checkin.visitorId;
      }
      continue;
    }
    map.set(key, {
      key,
      visitorId: checkin.visitor?.id ?? checkin.visitorId,
      name: checkin.visitor?.fullName || "Unnamed visitor",
      email: checkin.visitor?.email,
      phone: checkin.visitor?.phone,
      company: checkin.visitor?.company,
      portraitUrl: checkin.visitor?.portraitUrl,
      verified: !!checkin.verified,
      visitCount: 1,
      lastVisitAt: checkin.dateCreated,
      history: [checkin],
    });
  }

  for (const group of map.values()) {
    group.history.sort((a, b) => b.dateCreated - a.dateCreated);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.lastVisitAt - a.lastVisitAt,
  );
}

export function GroupedVisitorsList({
  checkins,
  emptyTitle,
  emptyDescription,
  badgeByCheckinId,
}: GroupedVisitorsListProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [badgePrintTarget, setBadgePrintTarget] =
    useState<AwaitingCheckoutItem | null>(null);
  const [editTarget, setEditTarget] = useState<EditVisitorTarget | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<ManualVerifyTarget | null>(
    null,
  );
  const { loadingHref } = useNavigationLoading();
  const { hasCapability } = useCapabilities();
  const canEditProfile = hasCapability(CAPABILITIES.VISITOR_EDIT_PROFILE);
  const canVerify = hasCapability(CAPABILITIES.CHECKIN_APPROVE);

  const groups = useMemo(() => buildGroups(checkins), [checkins]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      const haystack = [g.name, g.email, g.phone, g.company]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [groups, query]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon className="h-6 w-6 text-muted-foreground" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          inputMode="search"
          placeholder="Search by visitor name, email, phone, or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 text-base md:text-sm min-h-[44px]"
          aria-label="Search visitors"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6 text-muted-foreground" />}
          title="No matches"
          description="Try a different search term, or clear the search to see everyone."
        />
      ) : (
        <ul className="space-y-2" role="list">
          {filtered.map((group) => {
            const isOpen = expanded.has(group.key);
            const isRepeat = group.visitCount > 1;
            return (
              <li
                key={group.key}
                className="rounded-lg border bg-card overflow-hidden"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggle(group.key)}
                      aria-expanded={isOpen}
                      className="w-full flex items-start gap-3 p-3 md:p-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                    >
                      {group.portraitUrl ? (
                        <Image
                          src={group.portraitUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover border shrink-0"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full bg-muted shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{group.name}</p>
                          {isRepeat && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5">
                              Returning · {group.visitCount} visits
                            </span>
                          )}
                          {group.verified && (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <ShieldCheck
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {[group.company, group.email, group.phone]
                            .filter(Boolean)
                            .join(" · ") || "No contact info on file"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last visit {formatRelative(group.lastVisitAt)}
                        </p>
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform mt-1 shrink-0",
                          isOpen && "rotate-90",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isOpen
                      ? "Hide visit history for this visitor"
                      : `Show ${group.visitCount} visit${group.visitCount === 1 ? "" : "s"} for this visitor`}
                  </TooltipContent>
                </Tooltip>

                {isOpen && (
                  <div className="border-t bg-muted/20">
                    {canEditProfile && group.visitorId && (
                      <div className="flex justify-end px-3 pt-3 md:px-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditTarget({
                                  visitorId: group.visitorId!,
                                  fullName: group.name,
                                  email: group.email,
                                  phone: group.phone,
                                  company: group.company,
                                })
                              }
                              className="min-h-[44px]"
                            >
                              <Pencil
                                className="mr-1 h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Edit details
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            Edit this visitor&apos;s name, contact details, and
                            company. Changes apply to their profile.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    <ul
                      className="divide-y"
                      role="list"
                      aria-label={`Visit history for ${group.name}`}
                    >
                      {group.history.map((checkin) => {
                        const viewHref = `/app/visitors/${checkin.id}`;
                        const isLoadingRow = loadingHref === viewHref;
                        const printable = badgeByCheckinId?.get(checkin.id);
                        const canPrintBadge = !!printable?.badgeQrToken;
                        const manual = checkin.manualVerification;
                        const verifierRole = roleLabel(manual?.verifiedByRole);
                        return (
                          <li
                            key={checkin.id}
                            className="flex flex-col gap-2 p-3 md:p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {checkin.purpose.purpose ||
                                  "No purpose recorded"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Submitted {formatDateTime(checkin.dateCreated)}
                              </p>
                              {manual?.manual && (
                                <p className="text-xs text-success mt-1 inline-flex items-center gap-1">
                                  <BadgeCheck
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    Verified by{" "}
                                    {manual.verifiedByName || "staff"}
                                    {verifierRole ? ` (${verifierRole})` : ""}
                                    {manual.verifiedAt
                                      ? ` · ${formatRelative(manual.verifiedAt)}`
                                      : ""}
                                  </span>
                                </p>
                              )}
                              {checkin.rejectionReason && (
                                <p className="text-xs text-destructive mt-1">
                                  Reason: {checkin.rejectionReason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 md:gap-3 md:justify-end flex-wrap">
                              <CheckinStateBadge state={checkin.state} />
                              {!checkin.verified && canVerify && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setVerifyTarget({
                                          checkinId: checkin.id,
                                          visitorName: group.name,
                                        })
                                      }
                                      className="min-h-[44px]"
                                    >
                                      <ShieldCheck
                                        className="mr-1 h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                      Verify
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Confirm you&apos;ve checked this visitor&apos;s
                                    ID and mark them as verified
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {canPrintBadge && printable && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setBadgePrintTarget(printable)
                                      }
                                      className="min-h-[44px]"
                                    >
                                      <Printer
                                        className="mr-1 h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                      Print badge
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Print or save this visitor&apos;s badge with
                                    the QR code reception scans at checkout
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <NavButton
                                    href={viewHref}
                                    size="sm"
                                    variant="outline"
                                    className="min-h-[44px]"
                                  >
                                    {isLoadingRow ? (
                                      <Loader2
                                        className="mr-1 h-3.5 w-3.5 animate-spin"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Eye
                                        className="mr-1 h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    )}
                                    Details
                                  </NavButton>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  Open the full details for this check-in
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <PrintBadgeModal
        open={badgePrintTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBadgePrintTarget(null);
        }}
        badge={
          badgePrintTarget
            ? buildBadgeData(badgePrintTarget)
            : {
                visitorName: "",
                statusLabel: "Approved",
                badgeQrToken: "",
              }
        }
      />

      <EditVisitorModal
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        visitor={editTarget}
      />

      <ManualVerifyDialog
        open={verifyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setVerifyTarget(null);
        }}
        target={verifyTarget}
      />
    </div>
  );
}
