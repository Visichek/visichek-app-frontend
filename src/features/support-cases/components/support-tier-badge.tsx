import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { SupportTier } from "@/types/enums";

const LABELS: Record<SupportTier, string> = {
  none: "Best-effort",
  standard: "Standard",
  priority: "Priority",
};

const HINTS: Record<SupportTier, string> = {
  none: "Best-effort response; no admin paging is triggered on this tenant's cases.",
  standard: "Admins are paged on case open and SLA-at-risk events; ack within the SLA window.",
  priority: "Admins are paged on every event for this tenant; acknowledgement is expected within a few hours.",
};

function variantFor(tier: SupportTier) {
  switch (tier) {
    case "none":
      return "secondary" as const;
    case "standard":
      return "info" as const;
    case "priority":
      return "warning" as const;
  }
}

export function SupportTierBadge({ tier }: { tier: SupportTier }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge variant={variantFor(tier)}>{LABELS[tier]}</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{HINTS[tier]}</TooltipContent>
    </Tooltip>
  );
}
