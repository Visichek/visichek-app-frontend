"use client";

import { Lock, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCapability } from "@/features/limitations/hooks/use-limitations";
import type { PlanFeatureKey } from "@/types/billing";

const UPGRADE_HREF = "/app/billing/change-plan";

const FEATURE_COPY: Record<
  PlanFeatureKey | string,
  { title: string; blurb: string; bullets: string[] }
> = {
  appointments: {
    title: "Appointments",
    blurb:
      "Pre-book visitors, sync to hosts, and run a clean schedule across the day.",
    bullets: [
      "Schedule and reschedule visits with the host",
      "Auto-link the visitor session on arrival",
      "Cut down no-shows with reminders",
    ],
  },
  branding: {
    title: "Tenant branding",
    blurb:
      "Replace the VisiChek look with your own colours, logo, and badge styling.",
    bullets: [
      "Custom primary, secondary, and accent colours",
      "Your logo on the kiosk, sidebar, and visitor badge",
      "Remove the \"Powered by VisiChek\" watermark",
    ],
  },
  badges: {
    title: "Badge printing",
    blurb: "Generate printable visitor badges with QR check-out and host name.",
    bullets: [
      "Auto-generate A6 / A7 badges on confirm",
      "QR-coded check-out token",
      "Host, department, and visit purpose on the badge",
    ],
  },
  kyc: {
    title: "ID verification (KYC)",
    blurb:
      "Scan a government ID once, auto-fill the visitor profile, and confirm identity.",
    bullets: [
      "OCR-driven full-name and date-of-birth extraction",
      "Verification badge stored against the visitor",
      "Speeds up returning-visitor check-in",
    ],
  },
  csv_export: {
    title: "CSV exports",
    blurb:
      "Pull visitor logs, dashboard rollups, and compliance data out as CSV.",
    bullets: [
      "Filtered visitor and audit-log exports",
      "Dashboard rollups for finance and ops",
      "NDPA-compliant compliance package zip",
    ],
  },
  host_email_notifications: {
    title: "Host email alerts",
    blurb:
      "Email the host the moment their guest arrives — and when they leave.",
    bullets: [
      "Arrival notifications routed to the host's email",
      "Configurable per department",
      "Cuts the \"are they here yet?\" pings",
    ],
  },
  multi_location: {
    title: "Multi-location",
    blurb:
      "Run more than one branch from the same tenant with shared staff and reporting.",
    bullets: [
      "Add unlimited physical branches",
      "Per-branch staff, departments, and dashboards",
      "Roll up visitor data across the whole company",
    ],
  },
  watchlist: {
    title: "Watchlist & flagged visitors",
    blurb:
      "Maintain a list of visitors who need extra scrutiny — or who should be denied entry.",
    bullets: [
      "Flag visitors at registration time",
      "Auto-alert security on arrival",
      "Available on the Enterprise plan",
    ],
  },
  sso: {
    title: "Single sign-on (SSO)",
    blurb:
      "Let staff sign in with your existing identity provider — no extra passwords.",
    bullets: [
      "SAML / OIDC integration",
      "Just-in-time user provisioning",
      "Available on the Enterprise plan",
    ],
  },
  incidents: {
    title: "Security incidents",
    blurb:
      "Log and triage security incidents with NDPA-compliant deadline tracking.",
    bullets: [
      "Capture data breaches, unauthorized access, and device loss",
      "Auto-set 72-hour NDPC notification deadlines per NDPA §38",
      "Drive incidents through investigate → contain → close",
    ],
  },
  audit: {
    title: "Audit log",
    blurb:
      "A read-only, append-only trail of every system action across your tenant.",
    bullets: [
      "Filter by actor, action type, and date range",
      "Export for internal review or compliance reporting",
      "Available on all paid tiers",
    ],
  },
  dpo: {
    title: "Data protection (DPO)",
    blurb:
      "Tools the DPO needs to honour NDPA-driven data-subject obligations.",
    bullets: [
      "Data subject requests (access, correction, deletion)",
      "Retention policies and deletion logs",
      "Sub-processor and consent registers",
    ],
  },
  geofencing: {
    title: "Geofencing",
    blurb:
      "Only accept check-ins from visitors who are physically on-site or close to an active approver.",
    bullets: [
      "Reject submissions from outside a configurable radius",
      "Fall back to live approver location when no fixed point is set",
      "Stop drive-by check-ins and remote spoofing",
    ],
  },
  visitor_policies: {
    title: "Visitor policies",
    blurb:
      "Configure how visitors check in — required ID scans, host approvals, consent gating, badge lifetime, and more.",
    bullets: [
      "Mandate ID scan, host approval, or NDPA consent on every check-in",
      "Enable self-registration via QR for unstaffed kiosks",
      "Auto check visitors out and control badge expiry",
    ],
  },
  email_preferences: {
    title: "Organisation email preferences",
    blurb:
      "Control what email VisiChek sends on behalf of your organisation — welcome, host-arrival, and visitor-badge mail.",
    bullets: [
      "Welcome email to new staff accounts",
      "Host arrival notifications",
      "Visitor badge sent to the visitor after check-in",
    ],
  },
};

// Generic copy for features that don't have a tailored entry (e.g. incidents,
// audit, compliance — backend-only feature keys that show up in
// `deniedEndpoints` but not `deniedFeatures`).
const GENERIC_COPY: { title: string; blurb: string; bullets: string[] } = {
  title: "Upgrade to unlock",
  blurb:
    "This area is part of the paid VisiChek plans. Upgrade your subscription to enable it for your team.",
  bullets: [
    "Unlock the full set of operational and compliance features",
    "Higher monthly visitor and storage limits",
    "Priority support and SLA on paid tiers",
  ],
};

export interface UpgradeFeatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Feature key from `deniedFeatures` — used to pick the headline + bullets.
   * Falls back to a generic upgrade pitch when the key is unknown.
   */
  featureKey?: PlanFeatureKey | string | null;
  /** Override the headline (e.g., when locking a specific page name). */
  title?: string;
  /** Override the body blurb. */
  description?: string;
}

/**
 * Modal shown when a tenant clicks a feature their current plan does not
 * include. Headline + bullets are keyed off `featureKey`; the CTA always
 * routes to the plan picker.
 */
export function UpgradeFeatureModal({
  open,
  onOpenChange,
  featureKey,
  title,
  description,
}: UpgradeFeatureModalProps) {
  const { navigateFromOverlay, loadingHref } = useNavigationLoading();
  const { limitations } = useCapability();
  const planLabel =
    limitations?.plan?.displayName ?? limitations?.plan?.name ?? "your current plan";

  const copy = (featureKey ? FEATURE_COPY[featureKey] : undefined) ?? GENERIC_COPY;
  const headline = title ?? copy.title;
  const body = description ?? copy.blurb;
  const isNavigating = loadingHref === UPGRADE_HREF;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-300/60 dark:bg-amber-500/15 dark:ring-amber-400/30">
            <Lock
              className="h-5 w-5 text-amber-700 dark:text-amber-300"
              aria-hidden="true"
            />
          </div>
          <DialogTitle className="font-display text-xl">
            {headline}
          </DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-foreground/80">
          {copy.bullets.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          You&apos;re currently on <span className="font-semibold">{planLabel}</span>.
          Upgrade to enjoy this and the rest of the paid feature set.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="min-h-[40px]"
          >
            Maybe later
          </Button>
          <Button
            className="min-h-[40px] gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
            onClick={() => {
              onOpenChange(false);
              navigateFromOverlay(UPGRADE_HREF);
            }}
          >
            {isNavigating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            View plans
            {!isNavigating && (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
