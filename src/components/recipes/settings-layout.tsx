"use client";

import { useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { PlanFeatureKey } from "@/types/billing";

export interface SettingsTab {
  id: string;
  label: string;
  /** Tooltip shown on hover (desktop) */
  description?: string;
  content: ReactNode;
  /**
   * When true, the tab is hidden entirely. Locked features are no longer
   * advertised outside the dashboard, so a plan-gated settings tab (e.g.
   * Branding for Free-plan tenants) is simply omitted from the tab strip
   * rather than rendered behind a padlock.
   */
  locked?: boolean;
  /** Feature key for the upgrade modal copy. Retained for callers; unused. */
  lockedFeatureKey?: PlanFeatureKey | string;
}

interface SettingsLayoutProps {
  title: string;
  tabs: SettingsTab[];
  /** Default active tab id — defaults to first tab */
  defaultTab?: string;
}

/**
 * Settings page layout matching the Claude-style pattern:
 * - Desktop (md+): left sidebar with vertical tab list + right content area
 * - Mobile (<md): horizontal scrollable tab strip at top + content below
 *
 * Shows a loading spinner on the clicked tab during transitions.
 */
export function SettingsLayout({ title, tabs, defaultTab }: SettingsLayoutProps) {
  // Locked tabs are hidden entirely — plan-gated settings sections are no
  // longer advertised. Everything below renders from the visible set only.
  const visibleTabs = tabs.filter((t) => !t.locked);
  const [activeTab, setActiveTab] = useState(
    defaultTab ?? visibleTabs[0]?.id ?? "",
  );
  const [isPending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const activeContent = visibleTabs.find((t) => t.id === activeTab)?.content;

  function switchTab(tab: SettingsTab) {
    if (tab.id === activeTab) return;
    setPendingTab(tab.id);
    startTransition(() => {
      setActiveTab(tab.id);
      setPendingTab(null);
    });
  }

  return (
    <div>
      {/* ── Mobile: sticky heading + tab strip ─────────────── */}
      {/* ── Desktop: static heading only ───────────────────── */}
      <div className="sticky top-14 z-[40] bg-background -mx-4 px-4 pb-3 pt-3 border-b border-border md:static md:mx-0 md:px-0 md:pb-0 md:pt-0 md:border-none md:bg-transparent">
        <h1 className="text-2xl font-semibold tracking-tight font-display mb-3 md:mb-6">
          {title}
        </h1>

        {/* ── Mobile: horizontal scrollable tabs ─────────────── */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isLoading = isPending && pendingTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors min-h-[40px] shrink-0 inline-flex items-center gap-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
              >
                {isLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                )}
                {tab.label}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* ── Desktop: sidebar + content ─────────────────────── */}
      <div className="flex gap-8">
        {/* Left tab sidebar — desktop only */}
        <nav
          className="hidden md:flex md:flex-col md:w-48 lg:w-52 shrink-0"
          aria-label="Settings sections"
        >
          <ul className="space-y-0.5 sticky top-20">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isLoading = isPending && pendingTab === tab.id;

              return (
                <li key={tab.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => switchTab(tab)}
                        className={cn(
                          "w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px] inline-flex items-center gap-2",
                          isActive
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                        role="tab"
                        aria-selected={isActive}
                        aria-label={tab.label}
                      >
                        {isLoading && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                        )}
                        <span className="flex-1 truncate">{tab.label}</span>
                      </button>
                    </TooltipTrigger>
                    {tab.description && (
                      <TooltipContent side="right">
                        {tab.description}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right content area */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {activeContent}
        </div>
      </div>
    </div>
  );
}
