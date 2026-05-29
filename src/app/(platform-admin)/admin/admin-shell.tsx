"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  LayoutDashboard,
  Building2,
  Inbox,
  CreditCard,
  Megaphone,
  Package,
  Tags,
  LifeBuoy,
  AlarmClock,
  Activity,
  Scale,
  Settings,
  Newspaper,
  Images,
  Users,
  Wallet,
  FileText,
  Headphones,
  ShieldCheck,
  HelpCircle,
  GraduationCap,
  ScrollText,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useSession } from "@/hooks/use-session";
import {
  useNotificationBuckets,
  useNotificationStream,
} from "@/features/notifications/hooks";
import { useDashboardLiveStream } from "@/features/dashboard/hooks/use-dashboard-live-stream";
import { filterAdminNavByPreset } from "@/lib/permissions/admin-access";

const CommandLauncher = dynamic(
  () =>
    import("@/components/navigation/command-launcher").then((m) => ({
      default: m.CommandLauncher,
    })),
  { ssr: false }
);
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils/cn";
import { useThemeSync } from "@/hooks/use-theme-sync";
import { clearBrandingStyles } from "@/lib/branding/apply-branding";
import { disableUserLocation } from "@/lib/geolocation/user-location";

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    description: "Range-aware, interactive platform analytics — tenants, revenue, risk, and live counters",
  },
  {
    label: "Customers",
    icon: Users,
    description: "Everything customer-facing — live tenants, signup queue, and marketing opt-ins",
    children: [
      {
        label: "Tenants",
        href: "/admin/tenants",
        icon: Building2,
        description: "Manage tenant organizations, bootstrap new tenants, and view their status",
      },
      {
        label: "Onboarding queue",
        href: "/admin/tenants/onboarding",
        icon: Inbox,
        description: "Review self-service signups from the marketing site — accept to provision a tenant, partial-accept to flag missing fields, or reject with notes",
        notificationBucket: "onboarding_queue",
      },
      {
        label: "Marketing opt-ins",
        href: "/admin/marketing",
        icon: Megaphone,
        description: "Export the deduplicated email list of every onboarding lead who consented to product updates — copy as BCC, download CSV, or open in your mail client",
      },
    ],
  },
  {
    label: "Billing",
    icon: Wallet,
    description: "Plans, subscriptions, and discount codes that shape revenue",
    children: [
      {
        label: "Plans",
        href: "/admin/plans",
        icon: Package,
        description: "Create and manage pricing plans, feature rules, and usage limits",
      },
      {
        label: "Subscriptions",
        href: "/admin/subscriptions",
        icon: CreditCard,
        description: "View and manage tenant subscriptions, change plans, and handle cancellations",
      },
      {
        label: "Discounts",
        href: "/admin/discounts",
        icon: Tags,
        description: "Create discount codes, set redemption limits, and track usage",
      },
    ],
  },
  {
    label: "Content",
    icon: FileText,
    description: "Marketing-site articles, media library, and pricing display",
    children: [
      {
        label: "Blog",
        href: "/admin/blogs",
        icon: Newspaper,
        description: "Write, edit, and publish articles for the public website using a Medium-style block editor",
      },
      {
        label: "Media",
        href: "/admin/media",
        icon: Images,
        description: "Manage the shared image and video library that powers blog articles and marketing pages",
      },
      // Issue 10: Pricing-content page — synchronizes the public
      // marketing pricing display to backend plan data. Lives under
      // Content because the audience is content / marketing ops, not
      // billing. Backend plans remain the source of truth; this view
      // is the editorial layer (display name, feature highlights,
      // ordering, CTAs).
      {
        label: "Pricing",
        href: "/admin/content/pricing",
        icon: Tags,
        description: "Manage the public pricing page: display names, marketing copy, feature highlights, CTAs, and ordering, synced to backend plans.",
      },
      {
        label: "FAQs",
        href: "/admin/content/faqs",
        icon: HelpCircle,
        description: "Manage the public FAQ page: questions, answers, section grouping, ordering, and footer copy.",
      },
      {
        label: "Legal Documents",
        href: "/admin/legal-documents",
        icon: ScrollText,
        description: "Author, version, and publish Visichek's own public legal copy — privacy policy, terms of service, cookie policy, and more — with an immutable version history.",
      },
    ],
  },
  {
    label: "Support",
    icon: Headphones,
    description: "Tenant support cases, SLA watch, and the background-job activity feed",
    children: [
      {
        label: "Support Cases",
        href: "/admin/support-cases",
        icon: LifeBuoy,
        description: "Review tenant support tickets, reply, post internal notes, and move cases through the workflow",
        notificationBucket: "support_cases",
      },
      {
        label: "SLA Watch",
        href: "/admin/support-cases/sla-watch",
        icon: AlarmClock,
        description: "Cases whose SLA deadline falls in the next 24 hours; work these first to stay in compliance",
      },
      {
        label: "Recent Activity",
        href: "/admin/jobs",
        icon: Activity,
        description: "Review the background writes you've triggered — pending, succeeded, or failed — and open any failure to debug it",
        notificationBucket: "jobs",
      },
      {
        label: "Data Subject Requests",
        href: "/admin/dsr",
        icon: Scale,
        description: "Cross-tenant read-only oversight of NDPA / GDPR data subject requests — SLA risk, status, and identity verification. Processing remains the tenant's responsibility.",
        notificationBucket: "dsr",
      },
    ],
  },
  {
    label: "Admins",
    href: "/admin/admins",
    icon: ShieldCheck,
    description: "Invite new platform admins, re-scope their access preset, and review 2FA posture",
  },
  {
    label: "Tutorials",
    href: "/admin/tutorials",
    icon: GraduationCap,
    description: "Step-by-step walkthroughs for the platform-admin tools — start, resume, or replay them anytime",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Manage your preferences, theme, security, and platform configuration",
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  // CRITICAL: keep this body hook-free. The inner component only mounts
  // when AuthGuard renders, which guarantees zero API traffic
  // (/me, /settings, /branding, etc.) for users without a valid admin
  // session.
  return (
    <AuthGuard shell="admin">
      <AdminShellInner>{children}</AdminShellInner>
    </AuthGuard>
  );
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { adminProfile } = useSession();
  const { logout } = useAuth();
  const { navigateFromOverlay } = useNavigationLoading();
  // Issue 2: feed unread notification counts into the sidebar so each
  // bucket (support cases, onboarding queue, jobs, ...) shows a badge
  // on its row and a pulsing dot on the parent group icon when the
  // rail is collapsed.
  const notificationCounts = useNotificationBuckets("admin");
  // Real-time unread updates over SSE; falls back to polling when down.
  useNotificationStream();
  // Real-time platform dashboard counters over SSE (admin slice).
  useDashboardLiveStream();

  // Issue 10: filter the static nav array by the admin's access
  // preset before handing it to the sidebar. The backend permission
  // dependency is authoritative for writes; this filter just keeps
  // the sidebar honest about what the user can usefully reach.
  const visibleNavItems = filterAdminNavByPreset(
    ADMIN_NAV_ITEMS,
    adminProfile?.accessPreset,
  );

  useThemeSync();

  // Platform admin never uses tenant branding — wipe any residual title/favicon
  // left over from a previous tenant session on this device. Also disable
  // geolocation capture: admins are never tenant-side approvers, so they
  // must not leak coordinates into any tenant's presence index.
  useEffect(() => {
    clearBrandingStyles();
    document.title = "VisiChek Admin";
    disableUserLocation();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <div className="min-h-screen bg-background">
        <AppSidebar
          items={visibleNavItems}
          notificationCounts={notificationCounts}
          brandName="VisiChek Admin"
          userInfo={{
            name: adminProfile?.fullName ?? "Admin",
            detail: adminProfile?.email ?? "",
            initial: adminProfile?.fullName?.charAt(0) ?? "A",
          }}
          onSearchClick={() => setCommandOpen(true)}
          onSettingsClick={() => navigateFromOverlay("/admin/settings")}
          settingsHref="/admin/settings"
          onLogoutClick={logout}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <MobileNavSheet
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          items={visibleNavItems}
          notificationCounts={notificationCounts}
        />

        <div
          className={cn(
            "transition-[padding-left] duration-200 ease-in-out",
            sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
          )}
        >
          <Topbar
            onMenuClick={() => setMobileNavOpen(true)}
            onSearchClick={() => setCommandOpen(true)}
          />
          <main id="main-content" className="p-4 lg:p-6">
            {children}
          </main>
        </div>

        {commandOpen && (
          <CommandLauncher externalOpen={commandOpen} onExternalOpenChange={setCommandOpen} />
        )}
      </div>
    </>
  );
}
