"use client";

import { useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Loader2, Lock } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useUpgradePrompt } from "@/features/limitations/components/upgrade-prompt-provider";
import type { PlanFeatureKey } from "@/types/billing";

export interface SettingsTab {
  id: string;
  label: string;
  /** Tooltip shown on hover (desktop) */
  description?: string;
  content: ReactNode;
  /**
   * When true, the tab is rendered with a shaking padlock and clicking it
   * opens the upgrade modal instead of switching the active tab. Use this
   * for tabs that are conceptually present on every tenant but only enabled
   * on paid plans (e.g. Branding for Free-plan tenants).
   */
  locked?: boolean;
  /** Feature key for the upgrade modal copy. Only used when `locked`. */
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
  const firstUnlocked = tabs.find((t) => !t.locked)?.id ?? tabs[0]?.id ?? "";
  const [activeTab, setActiveTab] = useState(defaultTab ?? firstUnlocked);
  const [isPending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const { promptUpgrade } = useUpgradePrompt();

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  function switchTab(tab: SettingsTab) {
    if (tab.locked) {
      promptUpgrade({
        featureKey: tab.lockedFeatureKey ?? null,
        title: tab.label,
      });
      return;
    }
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
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id && !tab.locked;
            const isLoading = isPending && pendingTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors min-h-[40px] shrink-0 inline-flex items-center gap-2 group/tab",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : tab.locked
                      ? "text-muted-foreground/70 hover:bg-muted/70 hover:text-foreground/70"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.locked ? `${tab.label} (locked — upgrade to unlock)` : tab.label}
              >
                {isLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                )}
                {tab.label}
                {tab.locked && (
                  <Lock
                    className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400 animate-padlock-shake-loop group-hover/tab:animate-padlock-shake group-hover/tab:[animation-iteration-count:3]"
                    aria-hidden="true"
                  />
                )}
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
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id && !tab.locked;
              const isLoading = isPending && pendingTab === tab.id;

              return (
                <li key={tab.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => switchTab(tab)}
                        className={cn(
                          "group/tab w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px] inline-flex items-center gap-2",
                          isActive
                            ? "bg-muted text-foreground"
                            : tab.locked
                              ? "text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground/70"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                        role="tab"
                        aria-selected={isActive}
                        aria-label={tab.locked ? `${tab.label} (locked — upgrade to unlock)` : tab.label}
                      >
                        {isLoading && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                        )}
                        <span className="flex-1 truncate">{tab.label}</span>
                        {tab.locked && (
                          <>
                            <Lock
                              className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400 animate-padlock-shake-loop group-hover/tab:animate-padlock-shake group-hover/tab:[animation-iteration-count:3]"
                              aria-hidden="true"
                            />
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                              Pro
                            </span>
                          </>
                        )}
                      </button>
                    </TooltipTrigger>
                    {(tab.description || tab.locked) && (
                      <TooltipContent side="right">
                        {tab.locked
                          ? `${tab.label} — upgrade your plan to unlock this section.`
                          : tab.description}
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
