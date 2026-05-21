import {
  LayoutDashboard,
  ClipboardList,
  LogOut,
  Printer,
  CalendarClock,
  CalendarDays,
  Building2,
  Users2,
  Sparkles,
  UserCog,
  GitBranch,
  CreditCard,
  Building,
  QrCode,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  AlarmClock,
  FileText,
  Archive,
  BookCheck,
  FileCheck2,
  DownloadCloud,
  Megaphone,
  Receipt,
  Tags,
  Layers,
  Compass,
  Bell,
  Table2,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TutorialType } from "@/types/tutorial";
import type { SystemUserRole } from "@/types/enums";

/**
 * Static catalog of every tutorial the engine can mount.
 *
 * This mirrors the backend's shell partition (platform / tenant /
 * cross-cutting) exactly — the backend refuses to RECORD progress for a
 * tutorial outside the caller's shell (403 AUTH_ROLE_MISMATCH), and this
 * catalog is the matching client-side DISPLAY filter that decides which
 * "Start tutorial" entry-points a given session sees.
 *
 * Each tutorial carries an anchorless content walkthrough (`steps`) so it
 * can run as a centered step-through directly from the Tutorials hub. The
 * spotlight renderer falls back to a centered card when a step has no DOM
 * anchor, so these read as a guided slideshow.
 */

export type TutorialShell = "platform" | "tenant" | "cross";

export interface TutorialStepContent {
  /** Stable id stored in the engine's local step state. */
  id: string;
  title: string;
  body: ReactNode;
}

export interface TutorialDefinition {
  type: TutorialType;
  title: string;
  /** One-line summary shown on the card and as the hover tooltip. */
  description: string;
  shell: TutorialShell;
  /**
   * Tenant roles that should SEE this tutorial. `super_admin` implicitly
   * sees every tenant tutorial, so it can be omitted from this list.
   * Ignored for platform / cross-cutting tutorials.
   */
  roles?: SystemUserRole[];
  /** Grouping header on the hub page. */
  category: string;
  icon: LucideIcon;
  /** Bump when the steps change meaningfully to force a re-run. */
  version: number;
  steps: TutorialStepContent[];
}

/** Compact helper so the catalog stays readable. */
function step(id: string, title: string, body: string): TutorialStepContent {
  return { id, title, body };
}

export const TUTORIALS: TutorialDefinition[] = [
  // ── Cross-cutting (any role, either shell) ─────────────────────────
  {
    type: "getting_started",
    title: "Getting started",
    description:
      "A quick orientation to VisiChek — the sidebar, the topbar, and how to find your way around.",
    shell: "cross",
    category: "Getting started & basics",
    icon: Compass,
    version: 1,
    steps: [
      step(
        "welcome",
        "Welcome to VisiChek",
        "This short tour shows you the basics so you can get productive fast. You can leave at any time and your progress is saved.",
      ),
      step(
        "sidebar",
        "The sidebar",
        "Everything you can do lives in the left sidebar. Hover any item to read what it does; collapse the rail with the panel button to free up screen space.",
      ),
      step(
        "topbar",
        "Search and notifications",
        "Use the search button (or Ctrl/Cmd-K) to jump anywhere instantly. The bell shows unread alerts that need your attention.",
      ),
      step(
        "help",
        "Coming back later",
        "You can re-run any tutorial from this Tutorials page whenever you like. Completed tutorials are marked so you always know what's left.",
      ),
    ],
  },
  {
    type: "notifications_intro",
    title: "Notifications & alerts",
    description:
      "Understand the bell, sidebar badges, and how real-time alerts keep you up to date.",
    shell: "cross",
    category: "Getting started & basics",
    icon: Bell,
    version: 1,
    steps: [
      step(
        "bell",
        "The notification bell",
        "The bell in the topbar shows your total unread count. Open it to see recent alerts and mark them as read.",
      ),
      step(
        "badges",
        "Sidebar badges",
        "Sidebar items light up with a count when something there needs you — pending approvals, new support replies, failed jobs, and more.",
      ),
      step(
        "realtime",
        "Real-time updates",
        "Counts update live as events happen, so you don't need to refresh. If the live connection drops, VisiChek quietly falls back to polling.",
      ),
    ],
  },
  {
    type: "data_table_basics",
    title: "Working with tables",
    description:
      "Learn how to sort, filter, select multiple rows, and open a row's details across the app.",
    shell: "cross",
    category: "Getting started & basics",
    icon: Table2,
    version: 1,
    steps: [
      step(
        "rows",
        "Open a row",
        "Click anywhere on a row to open its details. The action menu (⋯) on the right holds secondary actions like edit, archive, or delete.",
      ),
      step(
        "select",
        "Select many at once",
        "Use the checkboxes to select multiple rows, then use the bulk-action bar that appears to act on all of them at once.",
      ),
      step(
        "filter",
        "Filter and sort",
        "Most tables can be filtered and sorted from their header. On phones, tables collapse into easy-to-read cards automatically.",
      ),
    ],
  },
  {
    type: "settings_walkthrough",
    title: "Your settings",
    description:
      "Find your profile, theme, security, and notification preferences in one place.",
    shell: "cross",
    category: "Getting started & basics",
    icon: Settings2,
    version: 1,
    steps: [
      step(
        "open",
        "Open settings",
        "Settings live at the bottom of the sidebar and in your user menu. They're organized into sections down the left side.",
      ),
      step(
        "profile",
        "Profile & security",
        "Update your name, change your password, and manage two-factor authentication from the profile and security sections.",
      ),
      step(
        "prefs",
        "Theme & notifications",
        "Switch between light and dark themes and choose which notifications reach you. Changes save as you make them.",
      ),
    ],
  },

  // ── Platform-admin shell (role = "admin") ──────────────────────────
  {
    type: "admin_dashboard_overview",
    title: "Admin dashboard overview",
    description:
      "Read the platform dashboard: tenant growth, revenue, and the metrics that matter.",
    shell: "platform",
    category: "Platform overview",
    icon: LayoutDashboard,
    version: 1,
    steps: [
      step(
        "metrics",
        "Top-line metrics",
        "The dashboard summarizes platform health — active tenants, subscriptions, and revenue — at a glance.",
      ),
      step(
        "trends",
        "Trends & charts",
        "Charts show how key numbers move over time so you can spot growth or churn early.",
      ),
    ],
  },
  {
    type: "tenant_onboarding_review",
    title: "Reviewing onboarding requests",
    description:
      "Work the onboarding queue: review submissions, approve, or request changes.",
    shell: "platform",
    category: "Tenants & onboarding",
    icon: ClipboardList,
    version: 1,
    steps: [
      step(
        "queue",
        "The onboarding queue",
        "New tenant sign-ups land in the onboarding queue. Open a submission to review the company's details and documents.",
      ),
      step(
        "decision",
        "Approve or request changes",
        "Approve a submission to provision the tenant, or send it back with notes when something needs fixing.",
      ),
    ],
  },
  {
    type: "tenant_management",
    title: "Managing tenants",
    description:
      "Browse, search, and manage tenant accounts and their configuration.",
    shell: "platform",
    category: "Tenants & onboarding",
    icon: Building2,
    version: 1,
    steps: [
      step(
        "list",
        "The tenant list",
        "Every customer organization appears here. Click a tenant to open its detail page; use the checkboxes for bulk actions.",
      ),
      step(
        "detail",
        "Tenant details",
        "From a tenant's page you can review its plan, status, and usage, and take administrative actions.",
      ),
    ],
  },
  {
    type: "plans_setup",
    title: "Setting up plans",
    description:
      "Create and configure subscription plans, tiers, quotas, and features.",
    shell: "platform",
    category: "Billing & monetization",
    icon: Layers,
    version: 1,
    steps: [
      step(
        "create",
        "Create a plan",
        "Plans define what a tier costs and what it unlocks. Start a draft, set the tier, price, and billing cycle.",
      ),
      step(
        "features",
        "Features & quotas",
        "Attach feature flags and usage quotas to the plan, then publish it to make it available to subscriptions.",
      ),
    ],
  },
  {
    type: "subscriptions_management",
    title: "Managing subscriptions",
    description:
      "Track tenant subscriptions, statuses, and lifecycle changes.",
    shell: "platform",
    category: "Billing & monetization",
    icon: CreditCard,
    version: 1,
    steps: [
      step(
        "list",
        "Subscription list",
        "See every tenant subscription with its plan, status, and renewal date. Filter by status to find what needs attention.",
      ),
      step(
        "lifecycle",
        "Lifecycle states",
        "Subscriptions move through trialing, active, past-due, and cancelled. Open one to inspect or adjust it.",
      ),
    ],
  },
  {
    type: "discounts_setup",
    title: "Creating discounts",
    description:
      "Configure percentage or fixed discounts scoped to plans, tenants, or globally.",
    shell: "platform",
    category: "Billing & monetization",
    icon: Tags,
    version: 1,
    steps: [
      step(
        "type",
        "Discount type & scope",
        "Choose a percentage or fixed amount, then scope it globally, to a plan, or to a specific tenant.",
      ),
      step(
        "window",
        "Validity window",
        "Set when the discount is active. Expired or disabled discounts stop applying automatically.",
      ),
    ],
  },
  {
    type: "payments_review",
    title: "Reviewing payments",
    description:
      "Inspect invoices and payment activity across the platform.",
    shell: "platform",
    category: "Billing & monetization",
    icon: Receipt,
    version: 1,
    steps: [
      step(
        "invoices",
        "Invoices",
        "Review issued, paid, void, and refunded invoices. Open one to see its line items and status history.",
      ),
      step(
        "reconcile",
        "Reconciling",
        "Use filters to reconcile payments and spot anything that needs follow-up.",
      ),
    ],
  },
  {
    type: "marketing_tools",
    title: "Marketing tools",
    description:
      "Manage marketing content, opt-ins, and the public-facing site.",
    shell: "platform",
    category: "Content & marketing",
    icon: Megaphone,
    version: 1,
    steps: [
      step(
        "content",
        "Content & pricing",
        "Edit blog posts, media, pricing display, and FAQs that power the public marketing site.",
      ),
      step(
        "optins",
        "Marketing opt-ins",
        "Review who has opted in to marketing so you can plan campaigns within consent rules.",
      ),
    ],
  },
  {
    type: "admin_billing_overview",
    title: "Platform billing overview",
    description:
      "Understand how plans, subscriptions, discounts, and payments fit together.",
    shell: "platform",
    category: "Billing & monetization",
    icon: ScrollText,
    version: 1,
    steps: [
      step(
        "model",
        "The billing model",
        "Plans define pricing, subscriptions attach a plan to a tenant, discounts adjust the price, and payments record what was billed.",
      ),
      step(
        "flow",
        "Following the money",
        "Start from a tenant's subscription to trace its plan, any applied discounts, and its invoice history.",
      ),
    ],
  },

  // ── Tenant — Receptionist ──────────────────────────────────────────
  {
    type: "visitor_workflow",
    title: "Visitor check-in workflow",
    description:
      "The full front-desk flow: register a visitor, verify, approve, and check them in.",
    shell: "tenant",
    roles: ["receptionist", "dept_admin"],
    category: "Front desk",
    icon: ClipboardList,
    version: 1,
    steps: [
      step(
        "register",
        "Register a visitor",
        "Start a check-in to capture the visitor's name, phone, host, and purpose. The session is created in a registered state.",
      ),
      step(
        "verify",
        "Verify & approve",
        "Scan an ID or ask the host to approve. Pending visitors wait in the Pending tab until they're verified or denied.",
      ),
      step(
        "confirm",
        "Confirm check-in",
        "Confirming validates the details and generates a printable badge — the visitor is now checked in.",
      ),
    ],
  },
  {
    type: "visitor_checkout",
    title: "Checking visitors out",
    description: "Close out active visits by QR scan or manually.",
    shell: "tenant",
    roles: ["receptionist", "dept_admin"],
    category: "Front desk",
    icon: LogOut,
    version: 1,
    steps: [
      step(
        "active",
        "Active visitors",
        "The active list shows everyone currently on-site. It refreshes on its own so you always see who's in the building.",
      ),
      step(
        "checkout",
        "Check out",
        "Scan the badge QR or pick the visitor from the list to check them out and free up the visit.",
      ),
    ],
  },
  {
    type: "badge_printing",
    title: "Printing visitor badges",
    description: "Generate and print visitor badges in A6 or A7 format.",
    shell: "tenant",
    roles: ["receptionist", "dept_admin"],
    category: "Front desk",
    icon: Printer,
    version: 1,
    steps: [
      step(
        "format",
        "Pick a format",
        "When confirming a check-in, choose an A6 or A7 badge. A7 is the default and suits most label printers.",
      ),
      step(
        "print",
        "Print or re-print",
        "The badge is produced as a PDF you can print immediately, and you can re-download it from the visit's details later.",
      ),
    ],
  },
  {
    type: "appointments_today",
    title: "Today's appointments",
    description: "See and manage the visitors scheduled to arrive today.",
    shell: "tenant",
    roles: ["receptionist", "dept_admin"],
    category: "Front desk",
    icon: CalendarClock,
    version: 1,
    steps: [
      step(
        "today",
        "Today's list",
        "Scheduled appointments appear so you can greet expected visitors quickly and link their arrival to the booking.",
      ),
      step(
        "convert",
        "Arrive a guest",
        "When a scheduled guest arrives, start their check-in from the appointment so their details carry over.",
      ),
    ],
  },

  // ── Tenant — Department Admin ──────────────────────────────────────
  {
    type: "appointments_management",
    title: "Managing appointments",
    description:
      "Create, reschedule, and track appointments for your department's hosts.",
    shell: "tenant",
    roles: ["dept_admin"],
    category: "Department",
    icon: CalendarDays,
    version: 1,
    steps: [
      step(
        "create",
        "Book an appointment",
        "Schedule a visitor against a host, with date, time, and purpose. Statuses track scheduled, fulfilled, missed, and cancelled.",
      ),
      step(
        "manage",
        "Keep it current",
        "Reschedule or cancel as plans change. Front-desk staff see today's appointments to greet guests on arrival.",
      ),
    ],
  },
  {
    type: "department_settings",
    title: "Department settings",
    description: "Configure your department's details and visitor rules.",
    shell: "tenant",
    roles: ["dept_admin"],
    category: "Department",
    icon: Building,
    version: 1,
    steps: [
      step(
        "details",
        "Department details",
        "Set your department's name, manager, and contact details so visitors are routed correctly.",
      ),
      step(
        "rules",
        "Visitor rules",
        "Tune department-specific visitor handling so check-ins follow your team's process.",
      ),
    ],
  },
  {
    type: "dept_visitor_oversight",
    title: "Department visitor oversight",
    description:
      "Monitor the visitors and appointments scoped to your department.",
    shell: "tenant",
    roles: ["dept_admin"],
    category: "Department",
    icon: Users2,
    version: 1,
    steps: [
      step(
        "scope",
        "Your department's visitors",
        "You see visitors and appointments tied to your department, so you can keep an eye on who's expected and who's on-site.",
      ),
      step(
        "act",
        "Take action",
        "Open any visitor to review details, and use the front-desk tools to approve or check guests in and out.",
      ),
    ],
  },

  // ── Tenant — Super Admin ───────────────────────────────────────────
  {
    type: "tenant_onboarding_completion",
    title: "Completing your onboarding",
    description:
      "Confirm your organization's details and finish first-time setup.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: BookCheck,
    version: 1,
    steps: [
      step(
        "confirm",
        "Confirm your details",
        "On first login you're asked to confirm your organization's information. Review each field and complete anything still pending.",
      ),
      step(
        "next",
        "What comes next",
        "Once confirmed, set up branding, departments, branches, and staff to get your workspace ready.",
      ),
    ],
  },
  {
    type: "branding_setup",
    title: "Setting up branding",
    description:
      "Apply your logo and colors so the app and badges match your brand.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: Sparkles,
    version: 1,
    steps: [
      step(
        "logo",
        "Logo & colors",
        "Upload your logo and choose your brand colors. They apply across your workspace and visitor-facing screens.",
      ),
      step(
        "preview",
        "See it live",
        "Branding is applied immediately so you can preview how staff and visitors will experience your workspace.",
      ),
    ],
  },
  {
    type: "user_management",
    title: "Managing staff accounts",
    description: "Invite teammates and assign their roles.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: UserCog,
    version: 1,
    steps: [
      step(
        "invite",
        "Invite staff",
        "Add teammates and pick a role — receptionist, department admin, auditor, security officer, or DPO — to scope what they can do.",
      ),
      step(
        "manage",
        "Manage access",
        "Update roles or deactivate accounts as your team changes. Each role only sees the tools relevant to it.",
      ),
    ],
  },
  {
    type: "branches_setup",
    title: "Setting up branches",
    description: "Add and manage your physical locations.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: GitBranch,
    version: 1,
    steps: [
      step(
        "add",
        "Add a branch",
        "Create a branch for each physical location so visitors and staff are organized by site.",
      ),
      step(
        "status",
        "Active vs inactive",
        "Mark branches active or inactive to control where check-ins can happen.",
      ),
    ],
  },
  {
    type: "billing_management",
    title: "Managing your billing",
    description: "Review your plan, invoices, and payment details.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: CreditCard,
    version: 1,
    steps: [
      step(
        "plan",
        "Your plan",
        "See your current plan and what it includes. Locked features show what upgrading would unlock.",
      ),
      step(
        "invoices",
        "Invoices & payment",
        "Review past invoices and keep your payment details up to date to avoid interruptions.",
      ),
    ],
  },
  {
    type: "departments_setup",
    title: "Setting up departments",
    description: "Create departments and assign managers.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: Building,
    version: 1,
    steps: [
      step(
        "create",
        "Create departments",
        "Departments organize hosts and visitors. Create one per team and assign a manager.",
      ),
      step(
        "assign",
        "Assign staff",
        "Place staff into departments so visitor routing and oversight line up with your org structure.",
      ),
    ],
  },
  {
    type: "registration_qr",
    title: "Visitor self-registration QR",
    description:
      "Generate a signed QR code so visitors can register themselves.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: QrCode,
    version: 1,
    steps: [
      step(
        "generate",
        "Generate the QR",
        "Create a signed QR code visitors can scan to start their own registration before reaching the desk.",
      ),
      step(
        "display",
        "Put it to work",
        "Print or display the QR at your entrance. Scans create registered sessions your team can then verify.",
      ),
    ],
  },
  {
    type: "super_admin_visitor_log",
    title: "Company-wide visitor log",
    description:
      "Review every visit across all branches and departments.",
    shell: "tenant",
    roles: ["super_admin"],
    category: "Organization setup",
    icon: ScrollText,
    version: 1,
    steps: [
      step(
        "log",
        "The full log",
        "As a super admin you can see visits company-wide, not just one department. Filter by date and status to find what you need.",
      ),
      step(
        "export",
        "Reporting",
        "Use date filters to pull the records you need for reporting and audits.",
      ),
    ],
  },

  // ── Tenant — Auditor ───────────────────────────────────────────────
  {
    type: "audit_log_walkthrough",
    title: "Reading the audit log",
    description:
      "Navigate the read-only trail of system actions and export it.",
    shell: "tenant",
    roles: ["auditor", "dpo"],
    category: "Compliance",
    icon: ScrollText,
    version: 1,
    steps: [
      step(
        "trail",
        "The audit trail",
        "Every meaningful action is recorded here, read-only. Each row shows who did what, when, and to which record.",
      ),
      step(
        "filter",
        "Find & export",
        "Filter by time and action to narrow the trail, then export it for compliance evidence.",
      ),
    ],
  },

  // ── Tenant — Security Officer ──────────────────────────────────────
  {
    type: "incident_reporting",
    title: "Reporting an incident",
    description: "Log a security or data-protection incident.",
    shell: "tenant",
    roles: ["security_officer"],
    category: "Security & incidents",
    icon: ShieldAlert,
    version: 1,
    steps: [
      step(
        "create",
        "Open an incident",
        "Record what happened, its type, and the details. Each incident is timestamped the moment you create it.",
      ),
      step(
        "deadline",
        "The 72-hour clock",
        "A notification deadline is set 72 hours from creation, per NDPA Section 38. Watch for the warning banner as it approaches.",
      ),
    ],
  },
  {
    type: "incident_triage",
    title: "Triaging incidents",
    description:
      "Move incidents through investigation to containment and closure.",
    shell: "tenant",
    roles: ["security_officer"],
    category: "Security & incidents",
    icon: ShieldCheck,
    version: 1,
    steps: [
      step(
        "states",
        "Status flow",
        "Incidents move from open → investigating → contained → reported → closed. Update the status as you work the case.",
      ),
      step(
        "escalate",
        "Escalate when needed",
        "Add findings and escalate where appropriate so the right people are looped in quickly.",
      ),
    ],
  },
  {
    type: "ndpc_deadline_workflow",
    title: "NDPC notification deadlines",
    description:
      "Track the 72-hour reporting clock and record NDPC notification.",
    shell: "tenant",
    roles: ["security_officer", "dpo"],
    category: "Security & incidents",
    icon: AlarmClock,
    version: 1,
    steps: [
      step(
        "approaching",
        "Approaching deadlines",
        "Incidents within 24 hours of their deadline are highlighted so nothing slips. A banner warns you when any are close.",
      ),
      step(
        "notified",
        "Mark as notified",
        "Once you've notified the NDPC, record it on the incident with the time it was sent to stop the clock.",
      ),
    ],
  },

  // ── Tenant — DPO ───────────────────────────────────────────────────
  {
    type: "dsr_handling",
    title: "Handling data subject requests",
    description:
      "Work access, correction, deletion, and consent-withdrawal requests.",
    shell: "tenant",
    roles: ["dpo"],
    category: "Data protection",
    icon: FileText,
    version: 1,
    steps: [
      step(
        "intake",
        "Request types",
        "Data subjects can ask for access, correction, deletion, or to withdraw consent. Each request tracks its own status.",
      ),
      step(
        "resolve",
        "Work the request",
        "Move a request through pending → in-progress → completed (or rejected), keeping a record of how it was handled.",
      ),
    ],
  },
  {
    type: "retention_policies",
    title: "Retention policies",
    description:
      "Define how long data is kept and what happens when it expires.",
    shell: "tenant",
    roles: ["dpo"],
    category: "Data protection",
    icon: Archive,
    version: 1,
    steps: [
      step(
        "policy",
        "Set a policy",
        "Define retention periods for the data you hold and choose whether expiry deletes or anonymizes records.",
      ),
      step(
        "audit",
        "Proof of deletion",
        "Deletion logs record what was removed and when, giving you evidence for NDPA reporting.",
      ),
    ],
  },
  {
    type: "compliance_register",
    title: "The processing register",
    description:
      "Maintain your record of processing activities for NDPA.",
    shell: "tenant",
    roles: ["dpo"],
    category: "Data protection",
    icon: BookCheck,
    version: 1,
    steps: [
      step(
        "entries",
        "Register entries",
        "Record each processing activity — its purpose, lawful basis, and data categories — to keep your register current.",
      ),
      step(
        "maintain",
        "Keep it accurate",
        "Add entries as processing changes so your register always reflects reality at audit time.",
      ),
    ],
  },
  {
    type: "consent_log_export",
    title: "Exporting the consent log",
    description: "Pull consent records for a date range for NDPA reporting.",
    shell: "tenant",
    roles: ["dpo"],
    category: "Data protection",
    icon: FileCheck2,
    version: 1,
    steps: [
      step(
        "range",
        "Pick a date range",
        "Choose the start and end dates for the consent records you need.",
      ),
      step(
        "export",
        "Export for reporting",
        "Export the consent log to evidence lawful basis and consent capture for the period.",
      ),
    ],
  },
  {
    type: "compliance_export",
    title: "Compliance export package",
    description:
      "Download a complete compliance package as a single archive.",
    shell: "tenant",
    roles: ["dpo"],
    category: "Data protection",
    icon: DownloadCloud,
    version: 1,
    steps: [
      step(
        "package",
        "What's included",
        "The export bundles your compliance records into one ZIP — handy for audits and regulator requests.",
      ),
      step(
        "download",
        "Generate & download",
        "Trigger the export and download the archive when it's ready.",
      ),
    ],
  },
  {
    type: "privacy_notices",
    title: "Privacy notices",
    description:
      "Author the privacy notices visitors see and how consent is captured.",
    shell: "tenant",
    roles: ["dpo", "super_admin"],
    category: "Data protection",
    icon: FileText,
    version: 1,
    steps: [
      step(
        "write",
        "Write the notice",
        "Compose the privacy notice visitors are shown, setting the lawful basis and the language they'll read.",
      ),
      step(
        "mode",
        "Display mode",
        "Choose passive display or active consent so capture matches your legal requirements.",
      ),
    ],
  },
];

/** Fast lookup of a definition by its type. */
export const TUTORIALS_BY_TYPE: Record<TutorialType, TutorialDefinition> =
  TUTORIALS.reduce(
    (acc, t) => {
      acc[t.type] = t;
      return acc;
    },
    {} as Record<TutorialType, TutorialDefinition>,
  );

/**
 * The tutorials a given session should see.
 *
 * - Platform admins see platform + cross-cutting tutorials.
 * - Tenant users see cross-cutting tutorials plus the tenant tutorials
 *   their role is mapped to. `super_admin` sees every tenant tutorial,
 *   matching its "all staff and compliance features" access.
 *
 * This is purely a DISPLAY filter; the backend independently refuses to
 * record progress for a tutorial outside the caller's shell.
 */
export function resolveTutorialsForSession(
  sessionType: "admin" | "system_user" | null,
  role: SystemUserRole | null,
): TutorialDefinition[] {
  if (sessionType === "admin") {
    return TUTORIALS.filter(
      (t) => t.shell === "platform" || t.shell === "cross",
    );
  }
  if (sessionType === "system_user") {
    return TUTORIALS.filter((t) => {
      if (t.shell === "cross") return true;
      if (t.shell !== "tenant") return false;
      if (role === "super_admin") return true;
      return !!role && (t.roles?.includes(role) ?? false);
    });
  }
  // No session — show only the universal getting-started content.
  return TUTORIALS.filter((t) => t.shell === "cross");
}

/** Group definitions by their `category`, preserving catalog order. */
export function groupByCategory(
  definitions: TutorialDefinition[],
): Array<{ category: string; tutorials: TutorialDefinition[] }> {
  const order: string[] = [];
  const map = new Map<string, TutorialDefinition[]>();
  for (const def of definitions) {
    if (!map.has(def.category)) {
      map.set(def.category, []);
      order.push(def.category);
    }
    map.get(def.category)!.push(def);
  }
  return order.map((category) => ({
    category,
    tutorials: map.get(category)!,
  }));
}
