"use client";

import Link from "next/link";
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
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short description shown on hover — explains what this section does */
  description?: string;
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
  header?: React.ReactNode;
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

export function AppSidebar({
  items,
  header,
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
  const pathname = usePathname();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const isSettingsLoading = settingsHref ? loadingHref === settingsHref : false;
  const isHelpLoading = helpHref ? loadingHref === helpHref : false;

  // Filter out Settings from main nav — it's in the user dropdown now
  const mainNavItems = items.filter(
    (item) => item.label.toLowerCase() !== "settings",
  );

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
        {!collapsed &&
          (header || (
            <span className="text-lg font-bold font-display tracking-tight text-sidebar-foreground">
              VisiChek
            </span>
          ))}

        {onCollapsedChange && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onCollapsedChange(!collapsed)}
                className={cn(
                  "flex items-center justify-center rounded-md p-1.5 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                  "min-h-[32px] min-w-[32px]",
                )}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed
                ? "Expand the sidebar to show full navigation labels"
                : "Collapse the sidebar to an icon-only rail"}
            </TooltipContent>
          </Tooltip>
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
            const isActive = pathname.startsWith(item.href);
            const isLoading = loadingHref === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      onClick={() => handleNavClick(item.href)}
                      className={cn(
                        "group flex items-center rounded-lg text-sm font-medium transition-colors",
                        collapsed
                          ? "justify-center p-2 min-h-[40px]"
                          : "gap-3 px-3 py-2 min-h-[40px]",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {isLoading ? (
                        <Loader2
                          className="h-[18px] w-[18px] shrink-0 animate-spin text-sidebar-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            isActive
                              ? "text-sidebar-foreground"
                              : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                          )}
                          aria-hidden="true"
                        />
                      )}
                      {!collapsed && item.label}
                    </Link>
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
                      </div>
                    ) : (
                      item.description || item.label
                    )}
                  </TooltipContent>
                </Tooltip>
              </li>
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
