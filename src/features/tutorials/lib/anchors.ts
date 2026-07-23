/**
 * Registry of every `data-tutorial-anchor` the live tour can spotlight.
 *
 * The catalog (`catalog.ts`) references these names as a step's `anchor`;
 * the matching page tags the element with the SAME name. Keeping the names
 * here — one canonical list — stops the catalog and the pages from drifting
 * apart silently.
 *
 * Tagging a page:
 *
 *   import { tutorialAnchor } from "@/features/tutorials/lib/anchors";
 *   <Button {...tutorialAnchor("users-invite-button")}>Invite</Button>
 *
 * An anchor that isn't on the current page is harmless: the live tour
 * falls back to a centered step card over the real page, so coverage can
 * grow page-by-page without breaking anything.
 */

export const TUTORIAL_ANCHORS = {
  // ── Tenant — front desk (visitors page already tags these) ──────────
  "visitor-pending-tab": "Pending tab on the Visitors page",
  "visitor-checkout-button": "Check-out button on the Visitors page",
  "visitor-registration-qr": "Registration-QR button on the Visitors page",

  // ── Tenant — organization ──────────────────────────────────────────
  "appointments-new-button": "New-appointment button on the Appointments page",
  "users-invite-button": "Invite-staff button on the Users page",
  "departments-new-button": "New-department button on the Departments page",
  "branches-new-button": "New-branch button on the Branches page",
  "branding-logo-field": "Logo upload on the Branding page",
  "billing-plan-card": "Current-plan card on the Billing page",

  // ── Tenant — compliance ────────────────────────────────────────────
  "incidents-new-button": "Report-incident button on the Incidents page",
  "incidents-deadline-banner": "72-hour deadline banner on the Incidents page",
  "audit-export-button": "Export button on the Audit log page",

  // ── Platform admin ─────────────────────────────────────────────────
  "admin-dashboard-metrics": "Top metric cards on the admin dashboard",
  "onboarding-queue": "Submissions table on the onboarding queue",
  "tenants-table": "Organization list table",
  "plans-new-button": "New-plan button on the Plans page",
  "subscriptions-table": "Subscriptions list table",
  "discounts-new-button": "New-discount button on the Discounts page",
} as const;

export type TutorialAnchorName = keyof typeof TUTORIAL_ANCHORS;

/**
 * Spread onto an element to tag it as a tutorial spotlight target:
 * `<Button {...tutorialAnchor("users-invite-button")} />`. Typed against
 * the registry so a typo or stale name is a compile error.
 */
export function tutorialAnchor(name: TutorialAnchorName): {
  "data-tutorial-anchor": TutorialAnchorName;
} {
  return { "data-tutorial-anchor": name };
}
