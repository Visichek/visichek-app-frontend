"use client";

import {
  Activity,
  Clock,
  LogOut,
  ShieldAlert,
  Shield,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useDashboardLive } from "@/features/dashboard/hooks/use-dashboard-live-stream";
import type { DashboardLiveCounters } from "@/types/insights";
import type { SystemUserRole } from "@/types/enums";

type CounterKey = keyof DashboardLiveCounters;

const COUNTER_META: Record<CounterKey, { label: string; icon: LucideIcon }> = {
  currentlyActive: { label: "On-site now", icon: Users },
  awaitingCheckout: { label: "Awaiting checkout", icon: Clock },
  pendingApproval: { label: "Pending approval", icon: UserCheck },
  checkInsToday: { label: "Check-ins today", icon: Activity },
  checkOutsToday: { label: "Check-outs today", icon: LogOut },
  openIncidents: { label: "Open incidents", icon: ShieldAlert },
  incidentsApproachingDeadline: { label: "Deadline < 24h", icon: ShieldAlert },
  openDsr: { label: "Open DSRs", icon: Shield },
};

/** Which live counters each role cares about (auditor sees none). */
const ROLE_COUNTERS: Record<SystemUserRole, CounterKey[]> = {
  super_admin: ["currentlyActive", "openIncidents", "openDsr"],
  dept_admin: ["currentlyActive", "pendingApproval"],
  receptionist: ["currentlyActive", "awaitingCheckout", "checkInsToday", "checkOutsToday"],
  auditor: [],
  security_officer: ["openIncidents", "incidentsApproachingDeadline"],
  dpo: ["openDsr"],
};

/**
 * A thin strip of fast-moving counters pushed over SSE. Hidden until the first
 * frame arrives (best-effort: no stream → no strip, the page's polled queries
 * still show the same numbers in the KPI cards).
 */
export function LiveStrip({ role }: { role: SystemUserRole }) {
  const frame = useDashboardLive();
  const keys = ROLE_COUNTERS[role];

  if (!frame || keys.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Live
      </span>
      {keys.map((key) => {
        const meta = COUNTER_META[key];
        const Icon = meta.icon;
        return (
          <span key={key} className="inline-flex items-center gap-1.5 text-sm">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold tabular-nums">
              {frame.counters[key].toLocaleString()}
            </span>
            <span className="text-muted-foreground">{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}
