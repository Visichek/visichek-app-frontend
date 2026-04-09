"use client";

import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationDropdown } from "@/components/navigation/notification-dropdown";
import { DebugRefreshButton } from "@/components/navigation/debug-refresh-button";

interface TopbarProps {
  onMenuClick: () => void;
  onSearchClick?: () => void;
  title?: string;
}

export function Topbar({ onMenuClick, onSearchClick, title }: TopbarProps) {
  return (
    <header className="sticky top-0 z-sticky flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile hamburger */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden min-h-[44px] min-w-[44px]"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Open the navigation menu to browse pages
        </TooltipContent>
      </Tooltip>

      {/* Page title */}
      {title && (
        <h2 className="text-lg font-semibold tracking-tight hidden md:block">
          {title}
        </h2>
      )}

      <div className="ml-auto flex items-center gap-1">
        {/* Search — visible on mobile where sidebar search is hidden */}
        {onSearchClick && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden min-h-[44px] min-w-[44px]"
                onClick={onSearchClick}
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Search pages, actions, and settings (Ctrl+K)
            </TooltipContent>
          </Tooltip>
        )}

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Debug: manual token refresh trigger */}
        <DebugRefreshButton />

        {/* Notifications */}
        <NotificationDropdown />
      </div>
    </header>
  );
}
