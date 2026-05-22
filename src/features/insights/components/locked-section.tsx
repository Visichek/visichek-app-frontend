"use client";

import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LockedOverlay } from "@/features/limitations/components";
import { ANALYTICS_FEATURES } from "../lib/analytics-gates";
import type { SectionId } from "@/types/insights";

/** Human title + the upgrade feature key driving the modal copy, per section. */
const SECTION_LOCK_META: Record<
  SectionId,
  { title: string; featureKey: string | null }
> = {
  traffic: { title: "Visitor traffic", featureKey: null },
  visitStatus: { title: "Visit status breakdown", featureKey: null },
  topDepartments: { title: "Top departments", featureKey: null },
  hourly: { title: "Hourly traffic patterns", featureKey: ANALYTICS_FEATURES.hourly },
  audit: { title: "Audit activity", featureKey: ANALYTICS_FEATURES.audit },
  incident: { title: "Incident analytics", featureKey: ANALYTICS_FEATURES.compliance },
  dsr: { title: "Data-subject request analytics", featureKey: ANALYTICS_FEATURES.compliance },
  appointment: { title: "Appointment analytics", featureKey: ANALYTICS_FEATURES.roleTabs },
  newReturning: { title: "New vs returning visitors", featureKey: ANALYTICS_FEATURES.roleTabs },
  feed: { title: "Live activity feed", featureKey: ANALYTICS_FEATURES.roleTabs },
};

/**
 * A plan-locked Insights section. Renders a blurred placeholder card behind the
 * shared padlock overlay; clicking opens the upgrade modal pre-keyed to the
 * section's feature. Reuses the same affordance the rest of the app uses for
 * gated surfaces, so it auto-respects the "Hide locked items" preference.
 */
export function LockedSection({ id, height = 220 }: { id: SectionId; height?: number }) {
  const { title, featureKey } = SECTION_LOCK_META[id];
  return (
    <LockedOverlay locked featureKey={featureKey} title={title}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center justify-center rounded-lg bg-muted/50"
            style={{ height }}
            aria-hidden="true"
          >
            <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>
    </LockedOverlay>
  );
}
