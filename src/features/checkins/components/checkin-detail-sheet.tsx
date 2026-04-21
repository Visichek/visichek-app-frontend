// DEPRECATED — check-in detail is now a dedicated page at /app/visitors/{id}.
// Use `CheckinDetailView` from `./checkin-detail-view.tsx` instead. This no-op
// stub keeps straggling imports compiling until all call sites are cleaned up.

import type { CheckinOut } from "@/types/checkin";

interface CheckinDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: CheckinOut | null;
  onApprove: (checkin: CheckinOut) => void;
  onReject: (checkin: CheckinOut) => void;
}

/**
 * @deprecated Navigate to `/app/visitors/{id}` instead. Rendering this
 * component now produces nothing.
 */
export function CheckinDetailSheet(_props: CheckinDetailSheetProps) {
  void _props;
  return null;
}
