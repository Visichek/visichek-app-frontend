"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import {
  Loader2,
  Lock,
  Settings,
  LogOut,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { useAppSelector } from "@/lib/store/hooks";
import { selectBranding } from "@/lib/store/branding-slice";
import { AppLink } from "@/components/navigation/app-link";
import { useUpgradePrompt } from "@/features/limitations/components/upgrade-prompt-provider";
import type { NavItem, SidebarNotificationBucket } from "./app-sidebar";

function resolveBadge(
  item: NavItem,
  counts: Partial<Record<SidebarNotificationBucket, number>> | undefined,
): number {
  if (typeof item.badgeCount === "number" && item.badgeCount > 0)
    return item.badgeCount;
  if (item.notificationBucket && counts) {
    const c = counts[item.notificationBucket] ?? 0;
    return c > 0 ? c : 0;
  }
  return 0;
}

function formatMobileBadge(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function isGroup(item: NavItem): item is NavItem & { children: NavItem[] } {
  return Array.isArray(item.children) && item.children.length > 0;
}

function groupContainsPath(item: NavItem, pathname: string): boolean {
  if (!isGroup(item)) return false;
  return item.children.some(
    (child) => child.href && pathname.startsWith(child.href),
  );
}

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  notificationCounts?: Partial<Record<SidebarNotificationBucket, number>>;
}

export function MobileNavSheet({
  open,
  onOpenChange,
  items,
  notificationCounts,
}: MobileNavSheetProps) {
  const pathname = usePathname();
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();
  const { adminProfile, systemUserProfile, isAdmin, currentRole } =
    useSession();
  const { logout } = useAuth();
  const { promptUpgrade } = useUpgradePrompt();
  const branding = useAppSelector(selectBranding);
  const workspaceName = isAdmin
    ? "VisiChek Admin"
    : branding?.companyName ?? "VisiChek";
  // Tenant shell uses the tenant's uploaded logo when present, otherwise
  // falls back to the bundled VisiChek mark. Platform admin always uses
  // the platform mark — never tenant branding.
  const workspaceLogo = isAdmin
    ? "/visichek_logo.svg"
    : branding?.logoUrl ?? "/visichek_logo.svg";
  // Tenant logos are presigned, expiring URLs on the storage host (not in
  // next.config `remotePatterns`), so the next/image optimizer 400s on them.
  // Bypass it for remote/SVG logos — same reason the raw <link> favicon works.
  const logoUnoptimized =
    /^https?:/i.test(workspaceLogo) || workspaceLogo.endsWith(".svg");

  const displayName = isAdmin
    ? adminProfile?.fullName
    : systemUserProfile?.fullName;
  const displayDetail = isAdmin
    ? adminProfile?.email
    : currentRole
      ? currentRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : systemUserProfile?.email;

  const settingsPath = isAdmin ? "/admin/settings" : "/app/settings";
  // Help only exists in the tenant shell — platform admins have no support
  // cases page they own (they triage tenant cases, not their own).
  const helpPath = isAdmin ? null : "/app/support-cases";
  const isHelpLoading = helpPath ? loadingHref === helpPath : false;

  // Filter Settings from main nav since it's in the footer
  const mainNavItems = items.filter(
    (item) => item.label.toLowerCase() !== "settings",
  );

  // Mirror the AppSidebar grouping behavior: groups are collapsed by default
  // and auto-opened when the current path lives inside them. User toggles
  // are preserved within the same mount.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const item of mainNavItems) {
      if (groupContainsPath(item, pathname ?? "")) open.add(item.label);
    }
    return open;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const item of mainNavItems) {
        if (groupContainsPath(item, pathname ?? "") && !next.has(item.label)) {
          next.add(item.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, mainNavItems]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function renderLeaf(item: NavItem, nested = false) {
    const isActive = item.href ? pathname.startsWith(item.href) : false;
    const isLoading = loadingHref === item.href;
    const Icon = item.icon;
    const badge = resolveBadge(item, notificationCounts);

    if (item.locked) {
      return (
        <li key={item.href ?? item.label}>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              promptUpgrade({
                featureKey: item.lockedFeatureKey ?? null,
                title: item.label,
              });
            }}
            aria-label={`${item.label} (locked — upgrade to unlock)`}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors min-h-[44px]",
              nested && "pl-10 text-[13px]",
              "text-foreground/50 hover:bg-accent hover:text-foreground/70",
            )}
          >
            <span className="relative inline-flex shrink-0">
              <Icon
                className={cn(
                  "shrink-0 text-foreground/30",
                  nested ? "h-4 w-4" : "h-[18px] w-[18px]",
                )}
                aria-hidden="true"
              />
              <Lock
                className="absolute -right-1 -top-1 h-3 w-3 text-amber-600 dark:text-amber-400 animate-padlock-shake-loop"
                aria-hidden="true"
              />
            </span>
            <div className="flex-1 min-w-0">
              <span>{item.label}</span>
              {!nested && item.description && (
                <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">
                  {item.description}
                </p>
              )}
            </div>
            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Pro
            </span>
          </button>
        </li>
      );
    }

    return (
      <li key={item.href ?? item.label}>
        <AppLink
          href={item.href ?? "#"}
          onBeforeNavigate={() => {
            if (item.href) handleNavClick(item.href);
            onOpenChange(false);
          }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
            nested && "pl-10 text-[13px]",
            isActive
              ? "bg-accent text-accent-foreground"
              : "text-foreground/70 hover:bg-accent hover:text-foreground",
          )}
          aria-current={isActive ? "page" : undefined}
        >
          {isLoading ? (
            <Loader2
              className={cn(
                "shrink-0 animate-spin text-foreground",
                nested ? "h-4 w-4" : "h-[18px] w-[18px]",
              )}
              aria-hidden="true"
            />
          ) : (
            <Icon
              className={cn(
                "shrink-0",
                nested ? "h-4 w-4" : "h-[18px] w-[18px]",
                isActive ? "text-foreground" : "text-foreground/50",
              )}
              aria-hidden="true"
            />
          )}
          <div className="flex-1 min-w-0">
            <span>{item.label}</span>
            {!nested && item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {item.description}
              </p>
            )}
          </div>
          {badge > 0 && (
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
              aria-label={`${badge} unread`}
            >
              {formatMobileBadge(badge)}
            </span>
          )}
        </AppLink>
      </li>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle asChild>
            <div className="flex min-w-0 items-center gap-2 text-left">
              <Image
                src={workspaceLogo}
                alt=""
                width={28}
                height={28}
                priority
                unoptimized={logoUnoptimized}
                className="h-7 w-7 shrink-0 rounded object-contain"
              />
              <span className="truncate text-lg font-bold font-display tracking-tight">
                {workspaceName}
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile navigation">
          <ul className="space-y-0.5">
            {mainNavItems.map((item) => {
              if (isGroup(item)) {
                const open = openGroups.has(item.label);
                const containsActive = groupContainsPath(item, pathname ?? "");
                const GroupIcon = item.icon;
                const groupBadgeTotal = item.children.reduce(
                  (sum, c) => sum + resolveBadge(c, notificationCounts),
                  resolveBadge(item, notificationCounts),
                );
                return (
                  <li key={`group:${item.label}`}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.label)}
                      aria-expanded={open}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                        containsActive
                          ? "text-foreground"
                          : "text-foreground/70 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <GroupIcon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          containsActive ? "text-foreground" : "text-foreground/50",
                        )}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <span>{item.label}</span>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {groupBadgeTotal > 0 && !open && (
                        <span
                          className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
                          aria-label={`${groupBadgeTotal} unread in ${item.label}`}
                        >
                          {formatMobileBadge(groupBadgeTotal)}
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-foreground/40 transition-transform",
                          open && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {open && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.children.map((child) => renderLeaf(child, true))}
                      </ul>
                    )}
                  </li>
                );
              }
              return renderLeaf(item);
            })}
          </ul>
        </nav>

        {/* Footer: user info + settings + logout */}
        <div className="border-t px-3 py-3 space-y-1">
          {/* User identity */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {(displayName?.charAt(0) ?? "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight truncate">
                {displayName ?? "User"}
              </p>
              {displayDetail && (
                <p className="text-xs text-muted-foreground leading-tight truncate">
                  {displayDetail}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Settings link */}
          <button
            onClick={() => {
              navigate(settingsPath);
              onOpenChange(false);
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors w-full min-h-[44px]"
          >
            <Settings className="h-[18px] w-[18px] shrink-0 text-foreground/50" aria-hidden="true" />
            Settings
          </button>

          {/* Help — tenant shell only; opens the user's support cases page */}
          {helpPath && (
            <button
              onClick={() => {
                navigate(helpPath);
                onOpenChange(false);
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors w-full min-h-[44px]"
            >
              {isHelpLoading ? (
                <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-foreground" aria-hidden="true" />
              ) : (
                <HelpCircle className="h-[18px] w-[18px] shrink-0 text-foreground/50" aria-hidden="true" />
              )}
              Get help
            </button>
          )}

          {/* Logout */}
          <button
            onClick={() => {
              onOpenChange(false);
              logout();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full min-h-[44px]"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            Log out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
