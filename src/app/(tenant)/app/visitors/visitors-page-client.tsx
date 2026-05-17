"use client";

import { useMemo, useState } from "react";
import {
  QrCode,
  Loader2,
  UserMinus,
  UserPlus,
  Settings2,
  GraduationCap,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { AppLink } from "@/components/navigation/app-link";
import {
  usePendingApprovals,
  useTenantCheckins,
} from "@/features/checkins/hooks";
import { useAwaitingCheckout } from "@/features/visitors/hooks/use-visitors";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import type { CheckinOut, CheckinState } from "@/types/checkin";
import type { AwaitingCheckoutItem } from "@/types/visitor";
import { GroupedVisitorsList } from "@/features/visitors/components/grouped-visitors-list";
import { PendingApprovalsQueue } from "@/features/visitors/components/pending-approvals-queue";
import {
  TutorialRunner,
  useTutorialProgress,
  type TutorialStep,
} from "@/features/tutorials";
import { useCapability } from "@/features/limitations/hooks/use-limitations";
import { LockedOverlay } from "@/features/limitations/components/locked-overlay";

type VisitorsTabState = Extract<
  CheckinState,
  "pending_approval" | "approved" | "rejected" | "checked_out"
>;

interface TabDef {
  id: VisitorsTabState;
  href: string;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  tooltip: string;
}

const TABS: readonly TabDef[] = [
  {
    id: "pending_approval",
    href: "/app/visitors/pending",
    label: "Pending",
    emptyTitle: "No pending check-ins",
    emptyDescription: "New submissions appear here automatically.",
    tooltip: "Check-ins awaiting your review",
  },
  {
    id: "approved",
    href: "/app/visitors/approved",
    label: "Approved",
    emptyTitle: "No approved check-ins yet",
    emptyDescription:
      "Once you approve a pending check-in it will show up here.",
    tooltip: "Visitors you've let in",
  },
  {
    id: "rejected",
    href: "/app/visitors/rejected",
    label: "Rejected",
    emptyTitle: "No rejected check-ins",
    emptyDescription: "Rejected check-ins will show here with their reason.",
    tooltip: "Check-ins you've denied and why",
  },
  {
    id: "checked_out",
    href: "/app/visitors/checked-out",
    label: "Checked out",
    emptyTitle: "No checked-out visitors yet",
    emptyDescription: "Visitors appear here after their visit ends.",
    tooltip: "Visitors whose visit has ended",
  },
] as const;

interface VisitorsPageClientProps {
  activeState: VisitorsTabState;
}

export function VisitorsPageClient({ activeState }: VisitorsPageClientProps) {
  const { tenantId } = useSession();
  const { hasCapability } = useCapabilities();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  // Issue 3: capability-gated rather than role-string-gated so
  // dept_admin sees the entry point too.
  const canConfigureForm = hasCapability(CAPABILITIES.TENANT_FORM_CONFIGURE);
  const formBuilderHref = "/app/visitors/form-builder";
  // Free plan blocks POST/PATCH/DELETE on /v1/checkin-configs — the form
  // builder can't save changes there. Lock the entry point with the
  // shared upgrade overlay so the user sees the gate before clicking
  // through to a dead-end page.
  const { isEndpointDenied, isLoading: limitationsLoading } = useCapability();
  const isFormBuilderLocked =
    !limitationsLoading && isEndpointDenied("/v1/checkin-configs");
  // Free plan blocks POST /v1/visitors/registration-qr. Instead of locking the
  // QR generator page behind an overlay, swap the action for a one-click
  // "open the public kiosk in a new tab" — same self-service register flow,
  // just without the signed-token convenience.
  const isRegistrationQrLocked =
    !limitationsLoading && isEndpointDenied("/v1/visitors/registration-qr");

  // Issue 7: visitor workflow tutorial. The runner is mounted but
  // hidden by default; only opens on an explicit click below.
  const tutorial = useTutorialProgress("visitor_workflow", 1);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // The Pending tab is backed by the unified `/pending-approvals` queue,
  // which merges kiosk check-ins AND scheduled appointments. The other
  // tabs still use the per-state checkins endpoint — only kiosk
  // check-ins have approved/rejected/checked_out states to surface.
  const pendingApprovalsQuery = usePendingApprovals(tenantId ?? undefined);
  const approvedQuery = useTenantCheckins(tenantId ?? undefined, {
    state: "approved",
  });
  const rejectedQuery = useTenantCheckins(tenantId ?? undefined, {
    state: "rejected",
  });
  const checkedOutQuery = useTenantCheckins(tenantId ?? undefined, {
    state: "checked_out",
  });

  const counts: Record<VisitorsTabState, number> = {
    pending_approval: pendingApprovalsQuery.data?.length ?? 0,
    approved: approvedQuery.data?.length ?? 0,
    rejected: rejectedQuery.data?.length ?? 0,
    checked_out: checkedOutQuery.data?.length ?? 0,
  };

  // Other-state tabs stay on CheckinOut rows; the Pending tab renders
  // its own component below.
  const queryByState: Record<
    Exclude<VisitorsTabState, "pending_approval">,
    { data?: CheckinOut[]; isLoading: boolean }
  > = {
    approved: approvedQuery,
    rejected: rejectedQuery,
    checked_out: checkedOutQuery,
  };

  const activeQuery =
    activeState === "pending_approval" ? null : queryByState[activeState];
  const activeData = activeQuery?.data ?? [];

  // Awaiting-checkout is the only endpoint that carries the badge QR
  // token for already-approved visitors. The map is only consumed on the
  // Approved tab; the query is shared cache so the 5s poll is paid once.
  const awaitingCheckoutQuery = useAwaitingCheckout();
  const printableByCheckinId = useMemo(() => {
    const map = new Map<string, AwaitingCheckoutItem>();
    for (const item of awaitingCheckoutQuery.data ?? []) {
      if (item.sourceType !== "approved_checkin") continue;
      if (!item.badgeQrToken) continue;
      map.set(item.checkoutId, item);
    }
    return map;
  }, [awaitingCheckoutQuery.data]);

  const activeTab = TABS.find((t) => t.id === activeState) ?? TABS[0];

  // Issue 7: visitor workflow tutorial steps. Each step targets a
  // stable `data-tutorial-anchor` attribute the surrounding markup
  // applies. Anchors live on the tabs, the check-out button, and the
  // registration-QR button below so the spotlight cutout sits on
  // visible UI.
  const tutorialSteps: TutorialStep[] = useMemo(
    () => [
      {
        id: "pending-tab",
        anchor: "visitor-pending-tab",
        title: "Start with Pending",
        body: (
          <p>
            New kiosk submissions land in <strong>Pending</strong>. Approve to
            let the visitor in, deny to send them away with a reason. The badge
            on the tab tells you how many visitors are waiting.
          </p>
        ),
      },
      {
        id: "checkout-button",
        anchor: "visitor-checkout-button",
        title: "Checking visitors out",
        body: (
          <p>
            When a visitor finishes their visit, hit <strong>Check out
            visitor</strong>. You can scan their badge QR or pick them from the
            active list — both options lead to the same checkout confirmation.
          </p>
        ),
      },
      {
        id: "registration-qr",
        anchor: "visitor-registration-qr",
        title: "Self-service kiosk QR",
        body: (
          <p>
            <strong>Registration QR</strong> mints a department-scoped code
            visitors can scan with their phone. Anyone who scans is dropped
            into the right department automatically — no manual data entry at
            the front desk.
          </p>
        ),
      },
      {
        id: "approved-tab",
        anchor: "visitor-approved-tab",
        title: "Approved visitors",
        body: (
          <p>
            Once you approve someone they move to <strong>Approved</strong>.
            Visitors with a printable badge show a QR you can reuse for badge
            re-print or quick check-out.
          </p>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="Review pending check-ins, approve or reject visitors, and see past activity."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            {canConfigureForm && (
              <LockedOverlay
                locked={isFormBuilderLocked}
                featureKey="csv_export"
                title="Configure visitor form"
                ctaLabel={null}
                className="flex-1 sm:flex-none"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavButton
                      href={formBuilderHref}
                      className="flex-1 sm:flex-none min-h-[44px]"
                    >
                      {loadingHref === formBuilderHref ? (
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Settings2
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                      )}
                      Configure form
                    </NavButton>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Customise the fields visitors fill in when they check in,
                    including required information and consent
                  </TooltipContent>
                </Tooltip>
              </LockedOverlay>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href="/app/visitors/checkout"
                  variant="outline"
                  className="flex-1 sm:flex-none min-h-[44px]"
                  data-tutorial-anchor="visitor-checkout-button"
                >
                  {loadingHref === "/app/visitors/checkout" ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <UserMinus
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  Check out visitor
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Choose how to check a visitor out — by scanning their badge or
                picking them from the list
              </TooltipContent>
            </Tooltip>
            {isRegistrationQrLocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 sm:flex-none min-h-[44px]"
                    onClick={() => {
                      if (!tenantId) return;
                      window.open(
                        `/register/${tenantId}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    disabled={!tenantId}
                    data-tutorial-anchor="visitor-registration-qr"
                  >
                    <UserPlus
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                    Register visitor
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Open the public visitor registration kiosk in a new tab so a
                  visitor can fill in their own details and check in
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavButton
                    href="/app/visitors/qr"
                    variant="outline"
                    className="flex-1 sm:flex-none min-h-[44px]"
                    data-tutorial-anchor="visitor-registration-qr"
                  >
                    {loadingHref === "/app/visitors/qr" ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <QrCode
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                    Registration QR
                  </NavButton>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Generate a QR code visitors can scan to self-register from
                  their phone
                </TooltipContent>
              </Tooltip>
            )}

            {/* Issue 7: tutorial entry point. Never auto-launches — only
                appears here as a button. Copy switches between Start /
                Resume / Restart based on persisted progress. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTutorialOpen(true)}
                  className="flex-1 sm:flex-none min-h-[44px]"
                  disabled={tutorial.isLoading}
                >
                  <GraduationCap
                    className="mr-2 h-4 w-4"
                    aria-hidden="true"
                  />
                  {tutorial.status === "completed"
                    ? "Restart tutorial"
                    : tutorial.status === "in_progress"
                      ? "Resume tutorial"
                      : "Start tutorial"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Take a quick tour of the visitor workflow — approvals, check
                out, and the kiosk QR. Your progress is saved so you can pause
                and come back.
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <TutorialRunner
        name="visitor_workflow"
        version={1}
        steps={tutorialSteps}
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />

      <div
        className="flex gap-2 border-b overflow-x-auto"
        role="tablist"
        aria-label="Check-in states"
      >
        {TABS.map((tab) => {
          const isActive = activeState === tab.id;
          const isLoadingTab = loadingHref === tab.href;
          const count = counts[tab.id];
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <AppLink
                  href={tab.href}
                  role="tab"
                  aria-selected={isActive}
                  onBeforeNavigate={() => handleNavClick(tab.href)}
                  data-tutorial-anchor={
                    tab.id === "pending_approval"
                      ? "visitor-pending-tab"
                      : tab.id === "approved"
                        ? "visitor-approved-tab"
                        : undefined
                  }
                  className={cn(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors relative whitespace-nowrap inline-flex items-center gap-1.5 min-h-[44px]",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isLoadingTab && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-1 inline-flex items-center justify-center rounded-full text-xs font-semibold h-5 min-w-[20px] px-1.5",
                        tab.id === "pending_approval"
                          ? "bg-warning text-warning-foreground"
                          : isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                      aria-label={`${count} ${tab.label.toLowerCase()}`}
                    >
                      {count}
                    </span>
                  )}
                </AppLink>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tab.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {activeState === "pending_approval" ? (
        <PendingApprovalsQueue tenantId={tenantId ?? undefined} />
      ) : (
        <GroupedVisitorsList
          checkins={activeData}
          emptyTitle={activeTab.emptyTitle}
          emptyDescription={activeTab.emptyDescription}
          badgeByCheckinId={
            activeState === "approved" ? printableByCheckinId : undefined
          }
        />
      )}
    </div>
  );
}
