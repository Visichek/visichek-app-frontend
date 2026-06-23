"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { FreePlanBanner } from "@/components/billing/free-plan-banner";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Building,
  GitBranch,
  UserCog,
  UserRound,
  ShieldAlert,
  ScrollText,
  Shield,
  CreditCard,
  LifeBuoy,
  Activity,
  Settings,
  ClipboardCheck,
  Briefcase,
  ShieldCheck,
  Headphones,
  GraduationCap,
  FileCheck,
  History,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { useAppSelector } from "@/lib/store/hooks";
import { selectBranding } from "@/lib/store/branding-slice";

const CommandLauncher = dynamic(
  () =>
    import("@/components/navigation/command-launcher").then((m) => ({
      default: m.CommandLauncher,
    })),
  { ssr: false }
);
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_ROUTES } from "@/lib/permissions/route-access";
import { cn } from "@/lib/utils/cn";
import { useThemeSync } from "@/hooks/use-theme-sync";
import { requestUserLocation } from "@/lib/geolocation/user-location";
import { useCapability } from "@/features/limitations/hooks/use-limitations";
import { UpgradePromptProvider } from "@/features/limitations/components/upgrade-prompt-provider";
import { HideLockedExpiryToast } from "@/features/limitations/components/hide-locked-expiry-toast";
import { HideLockedMenuItem } from "@/features/limitations/components/hide-locked-menu-item";
import {
  useNotificationBuckets,
  useNotificationStream,
} from "@/features/notifications/hooks";
import { usePushAutoRefresh } from "@/features/push";
import { useDashboardLiveStream } from "@/features/dashboard/hooks/use-dashboard-live-stream";
import { AgreementAcceptanceBanner } from "@/features/agreements/components/agreement-acceptance-banner";
import {
  useTenantConfirmation,
  usePendingOnboardingFields,
} from "@/features/onboarding/hooks";
import type { PlanFeatureKey } from "@/types/billing";

// Roles that act as geofencing approvers in approver-proximity mode. When
// a tenant has not configured a fixed reference coordinate, visitor submits
// are accepted only if one of these users is physically within radius. We
// warm up the browser's location permission for them on shell mount so the
// presence beacon (the `X-User-Location` header on every authenticated
// request) starts populating Redis before a visitor actually tries to check in.
const GEOFENCE_APPROVER_ROLES = new Set([
  "super_admin",
  "dept_admin",
  "receptionist",
]);

/**
 * Map a nav item to a plan feature key OR an API prefix.
 * - `feature` matches against `Limitations.deniedFeatures` (stable short keys)
 * - `apiPrefix` matches against `Limitations.deniedEndpoints` (URL patterns)
 *   and is used for areas with no stable feature key (incidents, audit, dpo,
 *   compliance — entirely blocked on Free per the backend manifest)
 * When either match denies the item we render it as locked rather than
 * hiding it, so the tenant can see what the paid tiers unlock.
 */
type GatedNavItem = NavItem & {
  feature?: PlanFeatureKey;
  apiPrefix?: string;
  /** Fallback key passed to the upgrade modal when only `apiPrefix` matches. */
  lockKey?: PlanFeatureKey | string;
};

type GatedNavGroup = NavItem & { children: GatedNavItem[] };

const ALL_TENANT_NAV_ITEMS: (GatedNavItem | GatedNavGroup)[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    description: "Role-scoped, range-aware analytics — visitors, appointments, compliance, and live counters",
  },
  {
    label: "Front Desk",
    icon: ClipboardCheck,
    description: "Day-to-day visitor and appointment workflows for the reception team",
    children: [
      {
        label: "Visitors",
        href: "/app/visitors/pending",
        icon: Users,
        description: "Check in and check out visitors, view active sessions, and manage visitor profiles",
        notificationBucket: "visitors",
      },
      {
        label: "Appointments",
        href: "/app/appointments",
        icon: CalendarDays,
        description: "Schedule, view, and manage visitor appointments with hosts in your organization",
        feature: "appointments",
        notificationBucket: "appointments",
      },
    ],
  },
  {
    label: "Organization",
    icon: Briefcase,
    description: "Configure your departments, branch locations, and staff accounts",
    children: [
      {
        label: "Departments",
        href: "/app/departments",
        icon: Building,
        description: "Configure departments, assign managers, and set department-specific visitor rules",
      },
      {
        label: "Hosts",
        href: "/app/hosts",
        icon: UserRound,
        description: "Manage the roster of people visitors can be scheduled to see — including contractors and executives who don't have a login account",
        feature: "hosts",
      },
      {
        label: "Branches",
        href: "/app/branches",
        icon: GitBranch,
        description: "Manage physical branch locations and their operational status",
        feature: "multi_location",
      },
      {
        label: "Users",
        href: "/app/users",
        icon: UserCog,
        description: "Add, edit, and manage staff accounts and their roles within your organization",
      },
    ],
  },
  {
    label: "Compliance",
    icon: ShieldCheck,
    description: "Incidents, audit trail, and NDPA data-protection tooling in one place",
    children: [
      {
        label: "Incidents",
        href: "/app/incidents",
        icon: ShieldAlert,
        description: "Report and track security incidents, manage NDPC notification deadlines",
        notificationBucket: "incidents",
        apiPrefix: "/v1/incidents",
        lockKey: "incidents",
      },
      {
        label: "Audit Log",
        href: "/app/audit",
        icon: ScrollText,
        description: "View a read-only trail of all system actions for compliance and accountability",
        apiPrefix: "/v1/audit-logs",
        lockKey: "audit",
      },
      {
        label: "My activity",
        href: "/app/my-activity",
        icon: History,
        description: "A read-only record of every action you've taken in this workspace — your own scoped audit trail, available to all roles.",
        apiPrefix: "/v1/audit-logs",
      },
      {
        label: "Data Protection",
        href: "/app/dpo",
        icon: Shield,
        description: "Handle data subject requests, manage retention policies, and track compliance",
        apiPrefix: "/v1/dsr",
        lockKey: "dpo",
      },
    ],
  },
  {
    label: "Billing",
    href: "/app/billing",
    icon: CreditCard,
    description: "View your subscription plan, invoices, and manage payment details",
  },
  {
    label: "Support",
    icon: Headphones,
    description: "Open support tickets and review your recent background jobs",
    children: [
      {
        label: "Support Cases",
        href: "/app/support-cases",
        icon: LifeBuoy,
        description: "Open support tickets, reply to the VisiChek team, and track resolution of issues",
        notificationBucket: "support_cases",
      },
      {
        label: "Recent Activity",
        href: "/app/jobs",
        icon: Activity,
        description: "Review the background writes you've triggered — pending, succeeded, or failed — and open any failure to debug it",
        notificationBucket: "jobs",
      },
    ],
  },
  {
    label: "Agreements",
    href: "/app/agreements",
    icon: FileCheck,
    description: "Review the platform agreements your organization must accept — the Data Processing Agreement and Visitor Privacy Policy — and accept new versions when they're published",
  },
  {
    label: "Tutorials",
    href: "/app/tutorials",
    icon: GraduationCap,
    description: "Step-by-step walkthroughs for the tools available to your role — start, resume, or replay them anytime",
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: Settings,
    description: "Manage your preferences, theme, and notification settings",
  },
];

/**
 * Plan-gated pages that do NOT live as their own top-level nav entry.
 * The page-level redirect needs to know about these on top of the nav-
 * derived locks above — otherwise typing the URL bypasses the lock.
 *
 * Add an entry here whenever you ship a route whose gate is enforced
 * elsewhere in the UI (e.g. a button is hidden) rather than via the
 * sidebar.
 */
const EXTRA_LOCKED_ROUTES: Array<{
  pathPrefix: string;
  feature?: PlanFeatureKey;
  apiPrefix?: string;
}> = [
  // Visitor self-registration QR generator. The Visitors page already
  // swaps the entry button for free users; this catches direct-URL hits.
  {
    pathPrefix: "/app/visitors/qr",
    apiPrefix: "/v1/visitors/registration-qr",
  },
];

function formatRole(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TenantShell({ children }: { children: React.ReactNode }) {
  // CRITICAL: do NOT call any data-fetching hooks here. AuthGuard's children
  // are only instantiated when the gate decides to render — that's how we
  // guarantee zero API traffic (no /me, no /settings, no /limitations,
  // no /branding) for users without a valid session. All shell hooks live
  // inside <TenantShellInner>, which only mounts when AuthGuard renders
  // its children.
  return (
    <AuthGuard shell="system_user">
      <TenantShellInner>{children}</TenantShellInner>
    </AuthGuard>
  );
}

function TenantShellInner({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { currentRole, systemUserProfile } = useSession();
  const { logout } = useAuth();
  const { navigateFromOverlay } = useNavigationLoading();
  const pathname = usePathname() ?? "";
  const router = useRouter();

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

  useTenantBranding();
  useThemeSync();

  // Warm up the geolocation cache for approver roles. A single
  // `getCurrentPosition` call on mount triggers the browser's permission
  // prompt (if still "prompt"); once granted, the interceptor can start
  // attaching `X-User-Location` to every authenticated request. Denial
  // is sticky inside `requestUserLocation`, so we don't re-prompt on
  // navigation.
  useEffect(() => {
    if (!currentRole || !GEOFENCE_APPROVER_ROLES.has(currentRole)) return;
    requestUserLocation().catch(() => {
      // Best-effort — a missing header is a valid "no recent location"
      // signal to the backend, so swallow the rejection silently.
    });
  }, [currentRole]);
  const branding = useAppSelector(selectBranding);
  const workspaceName = branding?.companyName ?? "VisiChek";
  const workspaceLogo = branding?.logoUrl;

  const { gateDenied, isLoading: limitationsLoading } = useCapability();
  // Issue 2: tenant-side notification badges. Reuses the same
  // bucket-classification path the admin shell uses so the topbar bell,
  // sidebar badges, and any page-level alerts stay in sync.
  const notificationCounts = useNotificationBuckets("tenant");
  // Real-time unread updates over SSE; falls back to polling when down.
  useNotificationStream();
  // Silent push re-subscribe on login: no-ops unless push is already
  // permitted, so it never prompts — just keeps the backend subscription
  // fresh and re-pointed to the current user on this device.
  usePushAutoRefresh();
  // Real-time dashboard/insights counters over SSE (best-effort; the strip
  // stays hidden until the first frame arrives).
  useDashboardLiveStream();

  // First-login tenant-info confirmation gate (super_admin only). The
  // backend treats this as a soft prompt, but per product we make it a
  // blocking gate: a super admin whose `onboardingInfoConfirmed` is still
  // false is held on the confirmation screen until they submit. Existing
  // tenants default to false, so they are prompted exactly once.
  //
  // A 403 (not super_admin) / 404 (tenant missing) throws and leaves
  // `confirmation` undefined — we never block on an errored fetch, so the
  // shell degrades gracefully.
  const isSuperAdmin = currentRole === "super_admin";
  const onOnboardingRoute = pathname.startsWith("/app/onboarding");
  const { data: confirmation, isLoading: confirmationLoading } =
    useTenantConfirmation(isSuperAdmin);
  const needsConfirmation =
    isSuperAdmin && confirmation?.onboardingInfoConfirmed === false;
  // Pending onboarding fields (partial-accept) come first — only fetched
  // once we know the tenant still needs confirming, to avoid an extra call
  // for everyone else.
  const { data: pendingFields } = usePendingOnboardingFields(needsConfirmation);
  const hasPendingFields =
    !!pendingFields && pendingFields.pendingFieldKeys.length > 0;

  const onboardingRedirect =
    needsConfirmation && !onOnboardingRoute
      ? hasPendingFields
        ? "/app/onboarding/complete"
        : "/app/onboarding/confirm"
      : null;

  useEffect(() => {
    if (onboardingRedirect) router.replace(onboardingRedirect);
  }, [onboardingRedirect, router]);

  const visibleNavItems = useMemo<NavItem[]>(() => {
    if (!currentRole) return [];
    const allowedRoutes = ROLE_ROUTES[currentRole] ?? [];

    function roleAllowsLeaf(leaf: GatedNavItem): boolean {
      if (!leaf.href) return false;
      return allowedRoutes.some((route) => leaf.href!.startsWith(route));
    }

    // Plan-denied items are hidden from the sidebar entirely — we no longer
    // surface locked nav rows or padlocks here. Role-denied items are also
    // filtered out. The parent-group emptiness check below collapses any
    // group whose children all dropped out.
    //
    // While limitations are loading we treat every gated item as denied, so
    // a free user never sees a gated row flash in for ~200ms before
    // /me/limitations resolves and removes it.
    function toNavItem(leaf: GatedNavItem): NavItem | null {
      if (!roleAllowsLeaf(leaf)) return null;

      const hasGate = !!leaf.feature || !!leaf.apiPrefix;
      // Treat "still loading" as denied so a free user never sees a gated row
      // flash in before /me/limitations resolves and removes it.
      const denied =
        hasGate &&
        (limitationsLoading ||
          gateDenied({ feature: leaf.feature, apiPrefix: leaf.apiPrefix }));

      return denied ? null : leaf;
    }

    const visible: NavItem[] = [];
    for (const item of ALL_TENANT_NAV_ITEMS) {
      if (item.children) {
        const kids = (item.children as GatedNavItem[])
          .map(toNavItem)
          .filter((x): x is NavItem => x !== null);
        if (kids.length === 0) continue;
        visible.push({ ...item, children: kids });
      } else {
        const next = toNavItem(item as GatedNavItem);
        if (next) visible.push(next);
      }
    }
    return visible;
  }, [currentRole, gateDenied, limitationsLoading]);

  // Page-level lock check. Builds the set of href prefixes the current
  // plan denies (from nav items + extra map), then tests the current
  // pathname against it. Returns false while limitations are still
  // loading — the children gate below renders a skeleton in that window,
  // so the user can't see or interact with locked content before we know.
  const isOnLockedPath = useMemo(() => {
    if (limitationsLoading) return false;
    const lockedPrefixes: string[] = [];

    function collect(items: (GatedNavItem | GatedNavGroup)[]) {
      for (const item of items) {
        if (item.children) {
          collect(item.children as GatedNavItem[]);
          continue;
        }
        const leaf = item as GatedNavItem;
        if (!leaf.href) continue;
        if (gateDenied({ feature: leaf.feature, apiPrefix: leaf.apiPrefix })) {
          lockedPrefixes.push(leaf.href);
        }
      }
    }
    collect(ALL_TENANT_NAV_ITEMS);

    for (const route of EXTRA_LOCKED_ROUTES) {
      if (gateDenied({ feature: route.feature, apiPrefix: route.apiPrefix })) {
        lockedPrefixes.push(route.pathPrefix);
      }
    }

    return lockedPrefixes.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
  }, [pathname, gateDenied, limitationsLoading]);

  // Hard redirect when the user lands on a locked route — directly via
  // the URL bar, a bookmark, or a click that landed before the lock
  // resolved. Skeleton stays visible until the redirect completes so
  // the page content never paints.
  useEffect(() => {
    if (isOnLockedPath) router.replace("/app/dashboard");
  }, [isOnLockedPath, router]);

  // Hold the page behind a skeleton while the confirmation gate resolves or
  // a redirect is pending, so a super admin never sees the dashboard paint
  // for a frame before being bounced to the confirmation screen. Routes
  // under /app/onboarding render normally — that's where the gate sends them.
  const onboardingGatePending =
    isSuperAdmin && !onOnboardingRoute && (confirmationLoading || !!onboardingRedirect);
  const shouldBlockChildren =
    limitationsLoading || isOnLockedPath || onboardingGatePending;

  return (
    <UpgradePromptProvider>
      <HideLockedExpiryToast />
      <div className="min-h-screen bg-background">
        <AppSidebar
          items={visibleNavItems}
          notificationCounts={notificationCounts}
          logoUrl={workspaceLogo}
          brandName={workspaceName}
          userInfo={{
            name: systemUserProfile?.fullName ?? "User",
            detail: currentRole ? formatRole(currentRole) : systemUserProfile?.email ?? "",
            initial: systemUserProfile?.fullName?.charAt(0) ?? "U",
          }}
          onSearchClick={() => setCommandOpen(true)}
          onSettingsClick={() => navigateFromOverlay("/app/settings")}
          settingsHref="/app/settings"
          onHelpClick={() => navigateFromOverlay("/app/support-cases")}
          helpHref="/app/support-cases"
          onLogoutClick={logout}
          extraUserMenuItems={<HideLockedMenuItem />}
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
          <FreePlanBanner pathname={pathname} />
          <AgreementAcceptanceBanner />
          <main id="main-content" className="p-4 lg:p-6">
            {shouldBlockChildren ? <PageSkeleton /> : children}
          </main>
        </div>

        {commandOpen && (
          <CommandLauncher externalOpen={commandOpen} onExternalOpenChange={setCommandOpen} />
        )}
      </div>
    </UpgradePromptProvider>
  );
}
