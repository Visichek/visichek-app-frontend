"use client";

import {
  Activity,
  Building2,
  LifeBuoy,
  Shield,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useAdminDashboardLive } from "@/features/dashboard/hooks/use-dashboard-live-stream";
import type { AdminDashboardLiveCounters } from "@/types/insights";

type CounterKey = keyof AdminDashboardLiveCounters;

const COUNTER_META: Record<CounterKey, { label: string; icon: LucideIcon }> = {
  openIncidents: { label: "Open incidents", icon: ShieldAlert },
  criticalIncidents: { label: "Critical", icon: ShieldAlert },
  incidentsToday: { label: "Incidents today", icon: ShieldAlert },
  visitorCheckInsToday: { label: "Check-ins today", icon: Activity },
  newTenantsToday: { label: "New tenants today", icon: Building2 },
  supportCasesOpen: { label: "Open support", icon: LifeBuoy },
  dsrOpen: { label: "Open DSRs", icon: Shield },
};

const SHOWN: CounterKey[] = [
  "openIncidents",
  "criticalIncidents",
  "visitorCheckInsToday",
  "newTenantsToday",
  "supportCasesOpen",
  "dsrOpen",
];

/**
 * Platform live strip — fast-moving counters pushed over SSE
 * (GET /v1/dashboard/live/stream, admin slice). Hidden until the first frame
 * arrives (best-effort: no stream → no strip; the dashboard's own queries still
 * show the same numbers).
 */
export function AdminLiveStrip() {
  const frame = useAdminDashboardLive();
  if (!frame) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Live
      </span>
      {SHOWN.map((key) => {
        const meta = COUNTER_META[key];
        const Icon = meta.icon;
        return (
          <span key={key} className="inline-flex items-center gap-1.5 text-sm">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold tabular-nums">{frame.counters[key].toLocaleString()}</span>
            <span className="text-muted-foreground">{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}
