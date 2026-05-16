"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { UpgradeFeatureModal } from "./upgrade-feature-modal";
import type { PlanFeatureKey } from "@/types/billing";

interface UpgradePromptState {
  featureKey?: PlanFeatureKey | string | null;
  title?: string;
  description?: string;
}

interface UpgradePromptContextValue {
  /**
   * Open the upgrade modal pre-keyed to a specific feature. Pass `null`
   * to fall back to the generic upgrade pitch.
   */
  promptUpgrade: (state?: UpgradePromptState) => void;
}

const UpgradePromptContext = createContext<UpgradePromptContextValue | null>(
  null,
);

/**
 * Provides a single tenant-shell-wide upgrade modal. Any locked element
 * (nav rows, settings tabs, action buttons) calls `promptUpgrade()` and
 * the same modal opens, pre-themed to that feature.
 */
export function UpgradePromptProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<UpgradePromptState>({});

  const promptUpgrade = useCallback((next: UpgradePromptState = {}) => {
    setState(next);
    setOpen(true);
  }, []);

  const value = useMemo<UpgradePromptContextValue>(
    () => ({ promptUpgrade }),
    [promptUpgrade],
  );

  return (
    <UpgradePromptContext.Provider value={value}>
      {children}
      <UpgradeFeatureModal
        open={open}
        onOpenChange={setOpen}
        featureKey={state.featureKey}
        title={state.title}
        description={state.description}
      />
    </UpgradePromptContext.Provider>
  );
}

/**
 * Hook for opening the shared upgrade modal. Safe to call from any
 * component rendered under the tenant shell.
 */
export function useUpgradePrompt(): UpgradePromptContextValue {
  const ctx = useContext(UpgradePromptContext);
  if (!ctx) {
    // No provider — degrade to a no-op so non-tenant shells don't crash.
    return { promptUpgrade: () => {} };
  }
  return ctx;
}
