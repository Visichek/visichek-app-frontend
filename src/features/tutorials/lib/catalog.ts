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
import type { PreviewSpec } from "./preview-types";

/**
 * Static catalog of every tutorial the engine can mount.
 *
 * This mirrors the backend's shell partition (platform / tenant /
 * cross-cutting) exactly — the backend refuses to RECORD progress for a
 * tutorial outside the caller's shell (403 AUTH_ROLE_MISMATCH), and this
 * catalog is the matching client-side DISPLAY filter that decides which
 * "Start tutorial" entry-points a given session sees.
 *
 * Each step carries:
 *   - a `preview` — a token-styled mock of the real screen shown inside
 *     the step card so the user *sees the page* while they read. This is
 *     the default experience and works everywhere, including mobile.
 *   - an optional `route` (+ `anchor`) — when set, the step offers a
 *     "Try it live" jump that navigates to the real page and pins the
 *     spotlight to the actual UI element (`data-tutorial-anchor`). The
 *     anchor is optional: a route with no tagged anchor still drops the
 *     user on the live page with a centered step card.
 */

export type TutorialShell = "platform" | "tenant" | "cross";

export interface TutorialStepContent {
  /** Stable id stored in the engine's local step state. */
  id: string;
  title: string;
  body: ReactNode;
  /** Mock-page preview shown inside the step card. */
  preview: PreviewSpec;
  /** Real page this step describes — enables the "Try it live" jump. */
  route?: string;
  /** `data-tutorial-anchor` to spotlight on `route`'s page (optional). */
  anchor?: string;
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

/**
 * Compact step builder so the catalog stays readable.
 *
 * @param preview the mock-page spec — required so every step shows the page.
 * @param live    optional `{ route, anchor? }` enabling the "Try it live"
 *                jump. `anchor` is optional; omit it to land on the page
 *                without a precise cutout.
 */
function step(
  id: string,
  title: string,
  body: string,
  preview: PreviewSpec,
  live?: { route: string; anchor?: string },
): TutorialStepContent {
  return {
    id,
    title,
    body,
    preview,
    route: live?.route,
    anchor: live?.anchor,
  };
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
        { kind: "shell", highlight: "none", label: "VisiChek" },
      ),
      step(
        "sidebar",
        "The sidebar",
        "Everything you can do lives in the left sidebar. Hover any item to read what it does; collapse the rail with the panel button to free up screen space.",
        { kind: "shell", highlight: "sidebar", label: "Navigation" },
      ),
      step(
        "topbar",
        "Search and notifications",
        "Use the search button (or Ctrl/Cmd-K) to jump anywhere instantly. The bell shows unread alerts that need your attention.",
        { kind: "shell", highlight: "topbar", label: "Topbar" },
      ),
      step(
        "help",
        "Coming back later",
        "You can re-run any tutorial from this Tutorials page whenever you like. Completed tutorials are marked so you always know what's left.",
        { kind: "cards", highlight: "none", label: "Tutorials" },
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
        { kind: "shell", highlight: "bell", label: "Alerts" },
      ),
      step(
        "badges",
        "Sidebar badges",
        "Sidebar items light up with a count when something there needs you — pending approvals, new support replies, failed jobs, and more.",
        { kind: "shell", highlight: "sidebar", label: "Navigation" },
      ),
      step(
        "realtime",
        "Real-time updates",
        "Counts update live as events happen, so you don't need to refresh. If the live connection drops, VisiChek quietly falls back to polling.",
        { kind: "shell", highlight: "bell", label: "Live" },
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
        { kind: "table", highlight: "row", label: "Records" },
      ),
      step(
        "select",
        "Select many at once",
        "Use the checkboxes to select multiple rows, then use the bulk-action bar that appears to act on all of them at once.",
        { kind: "table", highlight: "bulk-bar", label: "Records" },
      ),
      step(
        "filter",
        "Filter and sort",
        "Most tables can be filtered and sorted from their header. On phones, tables collapse into easy-to-read cards automatically.",
        { kind: "table", highlight: "search", label: "Records" },
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
        { kind: "settings", highlight: "sidebar", label: "Settings" },
      ),
      step(
        "profile",
        "Profile & security",
        "Update your name, change your password, and manage two-factor authentication from the profile and security sections.",
        { kind: "settings", highlight: "tab", label: "Profile & security" },
      ),
      step(
        "prefs",
        "Theme & notifications",
        "Switch between light and dark themes and choose which notifications reach you. Changes save as you make them.",
        { kind: "settings", highlight: "field", label: "Preferences" },
      ),
    ],
  },

  // ── Platform-admin shell (role = "admin") ──────────────────────────
  {
    type: "admin_dashboard_overview",
    title: "Admin dashboard overview",
    description:
      "Read the platform dashboard: organization growth, revenue, and the metrics that matter.",
    shell: "platform",
    category: "Platform overview",
    icon: LayoutDashboard,
    version: 1,
    steps: [
      step(
        "metrics",
        "Top-line metrics",
        "The dashboard summarizes platform health — active organizations, subscriptions, and revenue — at a glance.",
        { kind: "cards", highlight: "row", label: "Platform metrics" },
        { route: "/admin/dashboard", anchor: "admin-dashboard-metrics" },
      ),
      step(
        "trends",
        "Trends & charts",
        "Charts show how key numbers move over time so you can spot growth or churn early.",
        { kind: "chart", highlight: "chart", label: "Growth" },
        { route: "/admin/dashboard" },
      ),
    ],
  },
  {
    type: "tenant_onboarding_review",
    title: "Reviewing onboarding requests",
    description:
      "Work the onboarding queue: review submissions, approve, or request changes.",
    shell: "platform",
    category: "Organizations & onboarding",
    icon: ClipboardList,
    version: 1,
    steps: [
      step(
        "queue",
        "The onboarding queue",
        "New organization sign-ups land in the onboarding queue. Open a submission to review the company's details and documents.",
        { kind: "table", highlight: "row", label: "Onboarding queue" },
        { route: "/admin/tenants/onboarding", anchor: "onboarding-queue" },
      ),
      step(
        "decision",
        "Approve or request changes",
        "Approve a submission to provision the organization, or send it back with notes when something needs fixing.",
        { kind: "detail", highlight: "primary-action", label: "Submission" },
        { route: "/admin/tenants/onboarding" },
      ),
    ],
  },
  {
    type: "tenant_management",
    title: "Managing organizations",
    description:
      "Browse, search, and manage organization accounts and their configuration.",
    shell: "platform",
    category: "Organizations & onboarding",
    icon: Building2,
    version: 1,
    steps: [
      step(
        "list",
        "The organization list",
        "Every customer organization appears here. Click an organization to open its detail page; use the checkboxes for bulk actions.",
        { kind: "table", highlight: "row", label: "Organizations" },
        { route: "/admin/tenants", anchor: "tenants-table" },
      ),
      step(
        "detail",
        "Organization details",
        "From an organization's page you can review its plan, status, and usage, and take administrative actions.",
        { kind: "detail", highlight: "none", label: "Organization" },
        { route: "/admin/tenants" },
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
        { kind: "form", highlight: "primary-action", label: "New plan" },
        { route: "/admin/plans", anchor: "plans-new-button" },
      ),
      step(
        "features",
        "Features & quotas",
        "Attach feature flags and usage quotas to the plan, then publish it to make it available to subscriptions.",
        { kind: "form", highlight: "field", label: "Features & quotas" },
        { route: "/admin/plans" },
      ),
    ],
  },
  {
    type: "subscriptions_management",
    title: "Managing subscriptions",
    description:
      "Track organization subscriptions, statuses, and lifecycle changes.",
    shell: "platform",
    category: "Billing & monetization",
    icon: CreditCard,
    version: 1,
    steps: [
      step(
        "list",
        "Subscription list",
        "See every organization subscription with its plan, status, and renewal date. Filter by status to find what needs attention.",
        { kind: "table", highlight: "status", label: "Subscriptions" },
        { route: "/admin/subscriptions", anchor: "subscriptions-table" },
      ),
      step(
        "lifecycle",
        "Lifecycle states",
        "Subscriptions move through trialing, active, past-due, and cancelled. Open one to inspect or adjust it.",
        { kind: "detail", highlight: "status", label: "Subscription" },
        { route: "/admin/subscriptions" },
      ),
    ],
  },
  {
    type: "discounts_setup",
    title: "Creating discounts",
    description:
      "Configure percentage or fixed discounts scoped to plans, organizations, or globally.",
    shell: "platform",
    category: "Billing & monetization",
    icon: Tags,
    version: 1,
    steps: [
      step(
        "type",
        "Discount type & scope",
        "Choose a percentage or fixed amount, then scope it globally, to a plan, or to a specific organization.",
        { kind: "form", highlight: "field", label: "New discount" },
        { route: "/admin/discounts", anchor: "discounts-new-button" },
      ),
      step(
        "window",
        "Validity window",
        "Set when the discount is active. Expired or disabled discounts stop applying automatically.",
        { kind: "form", highlight: "field", label: "Validity" },
        { route: "/admin/discounts" },
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
        { kind: "table", highlight: "status", label: "Invoices" },
      ),
      step(
        "reconcile",
        "Reconciling",
        "Use filters to reconcile payments and spot anything that needs follow-up.",
        { kind: "table", highlight: "search", label: "Invoices" },
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
        { kind: "cards", highlight: "row", label: "Marketing" },
        { route: "/admin/marketing" },
      ),
      step(
        "optins",
        "Marketing opt-ins",
        "Review who has opted in to marketing so you can plan campaigns within consent rules.",
        { kind: "table", highlight: "row", label: "Opt-ins" },
        { route: "/admin/marketing" },
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
        "Plans define pricing, subscriptions attach a plan to an organization, discounts adjust the price, and payments record what was billed.",
        { kind: "cards", highlight: "none", label: "Billing model" },
      ),
      step(
        "flow",
        "Following the money",
        "Start from an organization's subscription to trace its plan, any applied discounts, and its invoice history.",
        { kind: "detail", highlight: "none", label: "Subscription" },
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
        { kind: "wizard", highlight: "primary-action", label: "Check in visitor" },
        { route: "/app/visitors/pending", anchor: "visitor-pending-tab" },
      ),
      step(
        "verify",
        "Verify & approve",
        "Scan an ID or ask the host to approve. Pending visitors wait in the Pending tab until they're verified or denied.",
        { kind: "wizard", highlight: "status", label: "Verify" },
        { route: "/app/visitors/pending", anchor: "visitor-pending-tab" },
      ),
      step(
        "confirm",
        "Confirm check-in",
        "Confirming validates the details and generates a printable badge — the visitor is now checked in.",
        { kind: "badge", highlight: "badge-doc", label: "Visitor badge" },
        { route: "/app/visitors/pending" },
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
        { kind: "table", highlight: "row", label: "On-site now" },
        { route: "/app/visitors/approved" },
      ),
      step(
        "checkout",
        "Check out",
        "Scan the badge QR or pick the visitor from the list to check them out and free up the visit.",
        { kind: "table", highlight: "primary-action", label: "On-site now" },
        { route: "/app/visitors/pending", anchor: "visitor-checkout-button" },
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
        { kind: "badge", highlight: "field", label: "Badge format" },
      ),
      step(
        "print",
        "Print or re-print",
        "The badge is produced as a PDF you can print immediately, and you can re-download it from the visit's details later.",
        { kind: "badge", highlight: "badge-doc", label: "Visitor badge" },
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
        { kind: "table", highlight: "row", label: "Today's appointments" },
        { route: "/app/appointments" },
      ),
      step(
        "convert",
        "Arrive a guest",
        "When a scheduled guest arrives, start their check-in from the appointment so their details carry over.",
        { kind: "table", highlight: "primary-action", label: "Today's appointments" },
        { route: "/app/appointments" },
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
        { kind: "form", highlight: "primary-action", label: "New appointment" },
        { route: "/app/appointments", anchor: "appointments-new-button" },
      ),
      step(
        "manage",
        "Keep it current",
        "Reschedule or cancel as plans change. Front-desk staff see today's appointments to greet guests on arrival.",
        { kind: "table", highlight: "row", label: "Appointments" },
        { route: "/app/appointments" },
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
        { kind: "form", highlight: "field", label: "Department" },
        { route: "/app/departments" },
      ),
      step(
        "rules",
        "Visitor rules",
        "Tune department-specific visitor handling so check-ins follow your team's process.",
        { kind: "form", highlight: "field", label: "Visitor rules" },
        { route: "/app/departments" },
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
        { kind: "table", highlight: "row", label: "Department visitors" },
        { route: "/app/visitors/pending" },
      ),
      step(
        "act",
        "Take action",
        "Open any visitor to review details, and use the front-desk tools to approve or check guests in and out.",
        { kind: "detail", highlight: "primary-action", label: "Visitor" },
        { route: "/app/visitors/pending" },
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
        { kind: "form", highlight: "field", label: "Confirm details" },
        { route: "/app/onboarding/confirm" },
      ),
      step(
        "next",
        "What comes next",
        "Once confirmed, set up branding, departments, branches, and staff to get your workspace ready.",
        { kind: "cards", highlight: "none", label: "Next steps" },
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
        { kind: "form", highlight: "field", label: "Branding" },
        { route: "/app/branding", anchor: "branding-logo-field" },
      ),
      step(
        "preview",
        "See it live",
        "Branding is applied immediately so you can preview how staff and visitors will experience your workspace.",
        { kind: "shell", highlight: "sidebar", label: "Your brand" },
        { route: "/app/branding" },
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
        { kind: "form", highlight: "primary-action", label: "Invite staff" },
        { route: "/app/users", anchor: "users-invite-button" },
      ),
      step(
        "manage",
        "Manage access",
        "Update roles or deactivate accounts as your team changes. Each role only sees the tools relevant to it.",
        { kind: "table", highlight: "row", label: "Staff accounts" },
        { route: "/app/users" },
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
        { kind: "form", highlight: "primary-action", label: "New branch" },
        { route: "/app/branches", anchor: "branches-new-button" },
      ),
      step(
        "status",
        "Active vs inactive",
        "Mark branches active or inactive to control where check-ins can happen.",
        { kind: "table", highlight: "status", label: "Branches" },
        { route: "/app/branches" },
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
        { kind: "cards", highlight: "row", label: "Your plan" },
        { route: "/app/billing", anchor: "billing-plan-card" },
      ),
      step(
        "invoices",
        "Invoices & payment",
        "Review past invoices and keep your payment details up to date to avoid interruptions.",
        { kind: "table", highlight: "row", label: "Invoices" },
        { route: "/app/billing" },
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
        { kind: "form", highlight: "primary-action", label: "New department" },
        { route: "/app/departments", anchor: "departments-new-button" },
      ),
      step(
        "assign",
        "Assign staff",
        "Place staff into departments so visitor routing and oversight line up with your org structure.",
        { kind: "table", highlight: "row", label: "Departments" },
        { route: "/app/departments" },
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
        { kind: "qr", highlight: "qr-code", label: "Registration QR" },
        { route: "/app/visitors/pending", anchor: "visitor-registration-qr" },
      ),
      step(
        "display",
        "Put it to work",
        "Print or display the QR at your entrance. Scans create registered sessions your team can then verify.",
        { kind: "qr", highlight: "none", label: "Display QR" },
        { route: "/app/visitors/qr" },
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
        { kind: "log", highlight: "timeline", label: "Visitor log" },
        { route: "/app/visitors/checked-out" },
      ),
      step(
        "export",
        "Reporting",
        "Use date filters to pull the records you need for reporting and audits.",
        { kind: "log", highlight: "primary-action", label: "Export" },
        { route: "/app/visitors/checked-out" },
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
        { kind: "log", highlight: "timeline", label: "Audit trail" },
        { route: "/app/audit" },
      ),
      step(
        "filter",
        "Find & export",
        "Filter by time and action to narrow the trail, then export it for compliance evidence.",
        { kind: "log", highlight: "primary-action", label: "Export" },
        { route: "/app/audit", anchor: "audit-export-button" },
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
        { kind: "form", highlight: "primary-action", label: "New incident" },
        { route: "/app/incidents", anchor: "incidents-new-button" },
      ),
      step(
        "deadline",
        "The 72-hour clock",
        "A notification deadline is set 72 hours from creation, per NDPA Section 38. Watch for the warning banner as it approaches.",
        { kind: "banner", highlight: "banner", label: "Incidents" },
        { route: "/app/incidents", anchor: "incidents-deadline-banner" },
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
        { kind: "detail", highlight: "status", label: "Incident" },
        { route: "/app/incidents" },
      ),
      step(
        "escalate",
        "Escalate when needed",
        "Add findings and escalate where appropriate so the right people are looped in quickly.",
        { kind: "detail", highlight: "primary-action", label: "Incident" },
        { route: "/app/incidents" },
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
        { kind: "banner", highlight: "banner", label: "Deadlines" },
        { route: "/app/incidents", anchor: "incidents-deadline-banner" },
      ),
      step(
        "notified",
        "Mark as notified",
        "Once you've notified the NDPC, record it on the incident with the time it was sent to stop the clock.",
        { kind: "detail", highlight: "status", label: "Incident" },
        { route: "/app/incidents" },
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
        { kind: "table", highlight: "row", label: "Data subject requests" },
        { route: "/app/dpo" },
      ),
      step(
        "resolve",
        "Work the request",
        "Move a request through pending → in-progress → completed (or rejected), keeping a record of how it was handled.",
        { kind: "detail", highlight: "status", label: "Request" },
        { route: "/app/dpo" },
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
        { kind: "form", highlight: "field", label: "Retention policy" },
        { route: "/app/dpo" },
      ),
      step(
        "audit",
        "Proof of deletion",
        "Deletion logs record what was removed and when, giving you evidence for NDPA reporting.",
        { kind: "log", highlight: "timeline", label: "Deletion logs" },
        { route: "/app/dpo" },
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
        { kind: "table", highlight: "row", label: "Processing register" },
        { route: "/app/dpo" },
      ),
      step(
        "maintain",
        "Keep it accurate",
        "Add entries as processing changes so your register always reflects reality at audit time.",
        { kind: "form", highlight: "primary-action", label: "New entry" },
        { route: "/app/dpo" },
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
        { kind: "form", highlight: "field", label: "Date range" },
        { route: "/app/dpo" },
      ),
      step(
        "export",
        "Export for reporting",
        "Export the consent log to evidence lawful basis and consent capture for the period.",
        { kind: "log", highlight: "primary-action", label: "Consent log" },
        { route: "/app/dpo" },
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
        { kind: "cards", highlight: "none", label: "Compliance package" },
        { route: "/app/dpo" },
      ),
      step(
        "download",
        "Generate & download",
        "Trigger the export and download the archive when it's ready.",
        { kind: "detail", highlight: "primary-action", label: "Export" },
        { route: "/app/dpo" },
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
        { kind: "form", highlight: "field", label: "Privacy notice" },
        { route: "/app/dpo" },
      ),
      step(
        "mode",
        "Display mode",
        "Choose passive display or active consent so capture matches your legal requirements.",
        { kind: "form", highlight: "field", label: "Display mode" },
        { route: "/app/dpo" },
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
