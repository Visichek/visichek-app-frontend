"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  PanelLeftClose,
  PanelLeft,
  Loader2,
  Settings,
  LogOut,
  ChevronUp,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { AppLink } from "@/components/navigation/app-link";

/**
 * Notification buckets the sidebar can render a badge for.
 *
 * Each bucket is a logical destination for unread notifications. The
 * backend `/v1/notifications/summary` endpoint (Issue 2) returns counts
 * keyed by these bucket names; the sidebar reads them via
 * `NavItem.notificationBucket` to surface a badge next to the matching
 * row and a pulsing dot when the rail is collapsed.
 */
export type SidebarNotificationBucket =
  | "visitors"
  | "appointments"
  | "onboarding_queue"
  | "support_cases"
  | "jobs"
  | "incidents"
  | "content"
  | "billing"
  | "plans"
  | "pricing";

export interface NavItem {
  label: string;
  /** Required for leaf items; omitted for groups (use `children` instead) */
  href?: string;
  icon: LucideIcon;
  /** Short description shown on hover — explains what this section does */
  description?: string;
  /** When present, this item is a group header that expands to reveal these sub-items */
  children?: NavItem[];
  /**
   * Notification bucket whose unread count drives this item's badge. The
   * shell supplies a `notificationCounts` map keyed by bucket; the
   * sidebar renders `count` as a badge on the row and as a pulsing red
   * dot on the parent group icon when collapsed.
   */
  notificationBucket?: SidebarNotificationBucket;
  /**
   * Hard-coded badge count. Used when the destination isn't fed by the
   * notification summary (e.g. a "Pending approvals" count derived from
   * a list query). Optional — prefer `notificationBucket` when possible.
   */
  badgeCount?: number;
  /**
   * Force a pulsing-dot indicator on this row even when no numeric count
   * is available. Useful for "something needs attention" cues like a
   * stale pricing publish.
   */
  attentionPulse?: boolean;
}

/**
 * Resolves the badge count for a given NavItem from the supplied counts
 * map plus any hard-coded `badgeCount`. Returns 0 when no badge should
 * render.
 */
function resolveBadgeCount(
  item: NavItem,
  counts: Partial<Record<SidebarNotificationBucket, number>> | undefined,
): number {
  if (typeof item.badgeCount === "number" && item.badgeCount > 0) {
    return item.badgeCount;
  }
  if (item.notificationBucket && counts) {
    const c = counts[item.notificationBucket] ?? 0;
    return c > 0 ? c : 0;
  }
  return 0;
}

/**
 * True when this item (or any descendant) should pulse/badge. Used to
 * decide whether a collapsed group icon shows the red dot.
 */
function itemHasAttention(
  item: NavItem,
  counts: Partial<Record<SidebarNotificationBucket, number>> | undefined,
): boolean {
  if (item.attentionPulse) return true;
  if (resolveBadgeCount(item, counts) > 0) return true;
  if (item.children?.some((c) => itemHasAttention(c, counts))) return true;
  return false;
}

function formatBadge(count: number): string {
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

interface UserInfo {
  name: string;
  /** Subtitle shown beneath the name (email, role, plan, etc.) */
  detail?: string;
  /** Avatar initial letter — defaults to first char of name */
  initial?: string;
}

interface AppSidebarProps {
  items: NavItem[];
  /**
   * Unread notification counts keyed by bucket. When set, items that
   * declare a `notificationBucket` render a numeric badge (or a pulsing
   * red dot on the parent group icon when the rail is collapsed). Pass
   * `undefined` to disable the badge layer entirely.
   */
  notificationCounts?: Partial<Record<SidebarNotificationBucket, number>>;
  /**
   * Custom header content. When omitted (or when `brandName` / `logoUrl`
   * are provided) the sidebar renders its own branded header: the tenant
   * (or platform) logo plus the workspace name. The expanded rail places
   * the logo on the left; the collapsed rail uses the logo itself as the
   * expand trigger (hover swaps it for the panel-open icon).
   */
  header?: React.ReactNode;
  /** Workspace logo URL — falls back to the VisiChek logo in `/public`. */
  logoUrl?: string;
  /** Workspace name shown next to the logo in the expanded rail. */
  brandName?: string;
  /** User info displayed at the bottom of the sidebar */
  userInfo?: UserInfo;
  /** Callback when search / command launcher is triggered */
  onSearchClick?: () => void;
  /** Called when user clicks Settings in the user dropdown — should navigate to settings page */
  onSettingsClick?: () => void;
  /** The href for the settings page — used to track loading state */
  settingsHref?: string;
  /** Called when user clicks Get help in the user dropdown — when omitted, the item is hidden (e.g. platform admin shell) */
  onHelpClick?: () => void;
  /** The href for the help destination — used to track loading state */
  helpHref?: string;
  /** Called when user clicks Log out in the user dropdown */
  onLogoutClick?: () => void;
  /** Whether the sidebar is collapsed to icon-only rail */
  collapsed?: boolean;
  /** Toggle collapsed state */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/** Path to the bundled VisiChek mark in `/public`. Used as the fallback
 *  whenever a tenant has not uploaded its own logo (and unconditionally in
 *  the platform-admin shell, which never applies tenant branding). */
const DEFAULT_BRAND_LOGO = "/visichek_logo.svg";
const DEFAULT_BRAND_NAME = "VisiChek";

export function AppSidebar({
  items,
  notificationCounts,
  header,
  logoUrl,
  brandName,
  userInfo,
  onSearchClick,
  onSettingsClick,
  settingsHref,
  onHelpClick,
  helpHref,
  onLogoutClick,
  collapsed = false,
  onCollapsedChange,
}: AppSidebarProps) {
  const resolvedLogoUrl = logoUrl ?? DEFAULT_BRAND_LOGO;
  const resolvedBrandName = brandName ?? DEFAULT_BRAND_NAME;
  const pathname = usePathname() ?? "";
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const isSettingsLoading = settingsHref ? loadingHref === settingsHref : false;
  const isHelpLoading = helpHref ? loadingHref === helpHref : false;

  // Filter out Settings from main nav — it's in the user dropdown now
  const mainNavItems = items.filter(
    (item) => item.label.toLowerCase() !== "settings",
  );

  // Track which groups are currently expanded in the rail. We seed from the
  // active path so a fresh page load opens the group that contains the
  // current route, and then let the user toggle freely from there. A full
  // page nav (see comment on the <a> tags below) re-runs this initializer.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const item of mainNavItems) {
      if (groupContainsPath(item, pathname)) open.add(item.label);
    }
    return open;
  });

  // If the route changes within the same React tree (e.g., admin shell
  // internal nav still uses client routing in places), auto-open the group
  // that owns the new path. We never auto-close a group the user opened.
  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const item of mainNavItems) {
        if (groupContainsPath(item, pathname) && !next.has(item.label)) {
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

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out",
        collapsed ? "lg:w-16" : "lg:w-64",
      )}
    >
      {/* ── Header: Brand + Collapse toggle ───────────────── */}
      <div
        className={cn(
          "flex h-14 items-center",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        {collapsed ? (
          // Collapsed rail: the logo IS the expand trigger. Hovering swaps
          // the logo for the panel-open icon so the affordance is obvious.
          onCollapsedChange ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCollapsedChange(false)}
                  className={cn(
                    "group relative flex items-center justify-center rounded-md p-1 transition-colors",
                    "hover:bg-sidebar-accent",
                    "min-h-[36px] min-w-[36px]",
                  )}
                  aria-label="Expand sidebar"
                >
                  <Image
                    src={resolvedLogoUrl}
                    alt=""
                    width={28}
                    height={28}
                    priority
                    unoptimized={resolvedLogoUrl.endsWith(".svg")}
                    className="h-7 w-7 shrink-0 rounded object-contain transition-opacity duration-150 group-hover:opacity-0"
                  />
                  <PanelLeft
                    className="absolute h-4 w-4 text-sidebar-foreground/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Expand the sidebar to show full navigation labels
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="flex h-9 w-9 items-center justify-center"
                  aria-label={resolvedBrandName}
                >
                  <Image
                    src={resolvedLogoUrl}
                    alt=""
                    width={28}
                    height={28}
                    priority
                    unoptimized={resolvedLogoUrl.endsWith(".svg")}
                    className="h-7 w-7 shrink-0 rounded object-contain"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">{resolvedBrandName}</TooltipContent>
            </Tooltip>
          )
        ) : (
          <>
            {header ?? (
              <div className="flex min-w-0 items-center gap-2">
                <Image
                  src={resolvedLogoUrl}
                  alt=""
                  width={28}
                  height={28}
                  priority
                  unoptimized={resolvedLogoUrl.endsWith(".svg")}
                  className="h-7 w-7 shrink-0 rounded object-contain"
                />
                <span className="truncate text-lg font-bold font-display tracking-tight text-sidebar-foreground">
                  {resolvedBrandName}
                </span>
              </div>
            )}

            {onCollapsedChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onCollapsedChange(true)}
                    className={cn(
                      "flex items-center justify-center rounded-md p-1.5 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                      "min-h-[32px] min-w-[32px]",
                    )}
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Collapse the sidebar to an icon-only rail
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* ── Search trigger ────────────────────────────────── */}
      {onSearchClick && (
        <div className={cn("pb-2", collapsed ? "px-2" : "px-3")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSearchClick}
                className={cn(
                  "flex items-center rounded-lg text-sm",
                  "text-muted-foreground hover:text-sidebar-foreground",
                  "hover:bg-sidebar-accent transition-colors",
                  collapsed
                    ? "w-full justify-center p-2 min-h-[40px]"
                    : "w-full gap-2 px-3 py-2 min-h-[40px]",
                )}
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span>Search</span>
                    <kbd className="ml-auto text-[10px] tracking-widest text-muted-foreground/60 font-mono">
                      Ctrl+K
                    </kbd>
                  </>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Search pages, actions, and settings across the app
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────── */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-2",
          collapsed ? "px-2" : "px-3",
        )}
        aria-label="Main navigation"
      >
        <ul className="space-y-0.5">
          {mainNavItems.map((item) => {
            if (isGroup(item)) {
              return (
                <SidebarGroup
                  key={`group:${item.label}`}
                  item={item}
                  pathname={pathname}
                  loadingHref={loadingHref}
                  handleNavClick={handleNavClick}
                  collapsed={collapsed}
                  open={openGroups.has(item.label)}
                  onToggle={() => toggleGroup(item.label)}
                  notificationCounts={notificationCounts}
                />
              );
            }
            return (
              <SidebarLeaf
                key={item.href ?? item.label}
                item={item}
                pathname={pathname}
                loadingHref={loadingHref}
                handleNavClick={handleNavClick}
                collapsed={collapsed}
                notificationCounts={notificationCounts}
              />
            );
          })}
        </ul>
      </nav>

      {/* ── User info footer with dropdown ────────────────── */}
      {userInfo && (
        <div
          className={cn(
            "border-t border-sidebar-border",
            collapsed ? "px-2 py-2" : "px-3 py-2",
          )}
        >
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center w-full rounded-lg transition-colors",
                      "hover:bg-sidebar-accent text-sidebar-foreground",
                      collapsed
                        ? "justify-center p-2 min-h-[44px]"
                        : "gap-3 px-3 py-2.5 min-h-[44px]",
                    )}
                  >
                    {/* Avatar circle */}
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {isSettingsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        (userInfo.initial || userInfo.name.charAt(0)).toUpperCase()
                      )}
                    </div>

                    {!collapsed && (
                      <>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {userInfo.name}
                          </p>
                          {userInfo.detail && (
                            <p className="text-xs text-sidebar-foreground/50 leading-tight truncate mt-0.5">
                              {userInfo.detail}
                            </p>
                          )}
                        </div>
                        <ChevronUp className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>
                {collapsed
                  ? `Signed in as ${userInfo.name}. Click to open account menu.`
                  : "Open your account menu for settings and sign-out"}
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align={collapsed ? "start" : "start"}
              sideOffset={8}
              className="w-56"
            >
              {/* User identity header */}
              <div className="px-2 py-2">
                <p className="text-sm font-medium truncate">{userInfo.name}</p>
                {userInfo.detail && (
                  <p className="text-xs text-muted-foreground truncate">
                    {userInfo.detail}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />

              {/* Settings */}
              {onSettingsClick && (
                <DropdownMenuItem
                  onClick={() => {
                    if (settingsHref) handleNavClick(settingsHref);
                    onSettingsClick();
                  }}
                  className="gap-2 min-h-[36px]"
                >
                  {isSettingsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  Settings
                </DropdownMenuItem>
              )}

              {/* Help — only rendered when the shell wires up a destination (tenant shell only) */}
              {onHelpClick && (
                <DropdownMenuItem
                  onClick={() => {
                    if (helpHref) handleNavClick(helpHref);
                    onHelpClick();
                  }}
                  className="gap-2 min-h-[36px]"
                >
                  {isHelpLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <HelpCircle className="h-4 w-4" />
                  )}
                  Get help
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Log out */}
              {onLogoutClick && (
                <DropdownMenuItem
                  onClick={onLogoutClick}
                  className="gap-2 min-h-[36px] text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}

// ── Leaf row ────────────────────────────────────────────────
interface SidebarLeafProps {
  item: NavItem;
  pathname: string;
  loadingHref: string | null;
  handleNavClick: (href: string) => void;
  collapsed: boolean;
  /** Render indented under a group header */
  nested?: boolean;
  notificationCounts?: Partial<Record<SidebarNotificationBucket, number>>;
}

function SidebarLeaf({
  item,
  pathname,
  loadingHref,
  handleNavClick,
  collapsed,
  nested = false,
  notificationCounts,
}: SidebarLeafProps) {
  const href = item.href ?? "#";
  const isActive = item.href ? pathname.startsWith(item.href) : false;
  const isLoading = loadingHref === item.href;
  const Icon = item.icon;
  const badge = resolveBadgeCount(item, notificationCounts);
  const showPulse = badge === 0 && item.attentionPulse === true;

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* SPA navigation via AppLink (Issue 8). AppLink renders a real
              <a href> so middle-click / ⌘-click / right-click "open in new
              tab" still work, but plain left-clicks go through
              router.push so the React tree (layouts, providers, React
              Query cache, /me bootstrap) survives between pages. The
              previous full-document GET threw all of that away on every
              sidebar click. */}
          <AppLink
            href={href}
            onBeforeNavigate={() => item.href && handleNavClick(item.href)}
            className={cn(
              "group flex items-center rounded-lg text-sm font-medium transition-colors",
              collapsed
                ? "justify-center p-2 min-h-[40px] relative"
                : "gap-3 px-3 py-2 min-h-[40px]",
              !collapsed && nested && "pl-9 text-[13px]",
              isActive
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative inline-flex shrink-0">
              {isLoading ? (
                <Loader2
                  className="h-[18px] w-[18px] shrink-0 animate-spin text-sidebar-foreground"
                  aria-hidden="true"
                />
              ) : (
                <Icon
                  className={cn(
                    "shrink-0 transition-colors",
                    nested && !collapsed ? "h-4 w-4" : "h-[18px] w-[18px]",
                    isActive
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                  )}
                  aria-hidden="true"
                />
              )}
              {/* Collapsed-rail pulse / badge — only on icon-level rows. */}
              {collapsed && badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-sidebar"
                  aria-label={`${badge} unread`}
                >
                  {formatBadge(badge)}
                </span>
              )}
              {collapsed && showPulse && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar animate-pulse"
                  aria-label="Needs attention"
                />
              )}
            </span>
            {!collapsed && (
              <>
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span
                    className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
                    aria-label={`${badge} unread`}
                  >
                    {formatBadge(badge)}
                  </span>
                )}
                {badge === 0 && showPulse && (
                  <span
                    className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse"
                    aria-label="Needs attention"
                  />
                )}
              </>
            )}
          </AppLink>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          {collapsed ? (
            <div>
              <div className="font-medium">{item.label}</div>
              {item.description && (
                <div className="mt-0.5 text-xs opacity-80">
                  {item.description}
                </div>
              )}
              {badge > 0 && (
                <div className="mt-1 text-xs font-medium text-destructive">
                  {badge} unread
                </div>
              )}
            </div>
          ) : (
            item.description || item.label
          )}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

// ── Collapsible group ─────────────────────────────────────────
interface SidebarGroupProps {
  item: NavItem & { children: NavItem[] };
  pathname: string;
  loadingHref: string | null;
  handleNavClick: (href: string) => void;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  notificationCounts?: Partial<Record<SidebarNotificationBucket, number>>;
}

function SidebarGroup({
  item,
  pathname,
  loadingHref,
  handleNavClick,
  collapsed,
  open,
  onToggle,
  notificationCounts,
}: SidebarGroupProps) {
  const Icon = item.icon;
  const containsActive = groupContainsPath(item, pathname);

  // Sum child badges + add the group's own (if it declares a bucket).
  const groupBadgeTotal = item.children.reduce(
    (sum, c) => sum + resolveBadgeCount(c, notificationCounts),
    resolveBadgeCount(item, notificationCounts),
  );
  const groupHasAttention = itemHasAttention(item, notificationCounts);

  // ── Collapsed rail: render the group icon and reveal children in a
  // dropdown to the right on click. The dropdown items now route via
  // AppLink (Issue 8) so opening a child does not trigger a full GET.
  if (collapsed) {
    return (
      <li>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "group relative flex w-full items-center justify-center rounded-lg p-2 min-h-[40px] text-sm font-medium transition-colors",
                    containsActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                  aria-label={item.label}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      containsActive
                        ? "text-sidebar-foreground"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                    )}
                    aria-hidden="true"
                  />
                  {/* Issue 2: pulsing red dot when any child has unread work.
                      A numeric badge would be misleading because the user
                      can't see which child it belongs to until they
                      expand — the rail is icon-only here. */}
                  {groupHasAttention && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-sidebar animate-pulse"
                      aria-label={
                        groupBadgeTotal > 0
                          ? `${groupBadgeTotal} unread in ${item.label}`
                          : `${item.label} needs attention`
                      }
                    />
                  )}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px]">
              <div>
                <div className="font-medium">{item.label}</div>
                {item.description && (
                  <div className="mt-0.5 text-xs opacity-80">
                    {item.description}
                  </div>
                )}
                {groupBadgeTotal > 0 && (
                  <div className="mt-1 text-xs font-medium text-destructive">
                    {groupBadgeTotal} unread
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={8}
            className="min-w-[12rem]"
          >
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {item.label}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {item.children.map((child) => {
              const childActive = child.href
                ? pathname.startsWith(child.href)
                : false;
              const ChildIcon = child.icon;
              const childLoading = loadingHref === child.href;
              const childBadge = resolveBadgeCount(child, notificationCounts);
              return (
                <DropdownMenuItem
                  key={child.href ?? child.label}
                  asChild
                  className={cn(
                    "gap-2 min-h-[36px]",
                    childActive && "bg-accent",
                  )}
                >
                  <AppLink
                    href={child.href ?? "#"}
                    fromOverlay
                    onBeforeNavigate={() =>
                      child.href && handleNavClick(child.href)
                    }
                  >
                    {childLoading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span className="flex-1">{child.label}</span>
                    {childBadge > 0 && (
                      <span
                        className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
                        aria-label={`${childBadge} unread`}
                      >
                        {formatBadge(childBadge)}
                      </span>
                    )}
                  </AppLink>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  }

  // ── Expanded rail: accordion-style header + indented children. The
  // header itself doesn't navigate (it's a toggle) so it stays a button;
  // the children inside use AppLink via SidebarLeaf.
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2 min-h-[40px] text-sm font-medium transition-colors",
              containsActive
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0 transition-colors",
                containsActive
                  ? "text-sidebar-foreground"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
              )}
              aria-hidden="true"
            />
            <span className="flex-1 text-left">{item.label}</span>
            {groupBadgeTotal > 0 && !open && (
              <span
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
                aria-label={`${groupBadgeTotal} unread in ${item.label}`}
              >
                {formatBadge(groupBadgeTotal)}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-sidebar-foreground/40 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          {item.description || `${item.label} — click to ${open ? "collapse" : "expand"}`}
        </TooltipContent>
      </Tooltip>
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <SidebarLeaf
              key={child.href ?? child.label}
              item={child}
              pathname={pathname}
              loadingHref={loadingHref}
              handleNavClick={handleNavClick}
              collapsed={collapsed}
              nested
              notificationCounts={notificationCounts}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
