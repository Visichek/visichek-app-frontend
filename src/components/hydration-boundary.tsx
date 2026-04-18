"use client";

import {
  HydrationBoundary as RQHydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

export interface HydrationBoundaryProps {
  state: DehydratedState;
  children: ReactNode;
}

/**
 * Thin wrapper around TanStack's HydrationBoundary. Kept as a project-local
 * component so we can add instrumentation (logging dehydration size etc.)
 * in one place later if needed.
 */
export function HydrationBoundary({ state, children }: HydrationBoundaryProps) {
  return <RQHydrationBoundary state={state}>{children}</RQHydrationBoundary>;
}
