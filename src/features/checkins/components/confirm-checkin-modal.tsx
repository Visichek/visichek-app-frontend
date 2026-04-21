// DEPRECATED — approve/reject is now a dedicated page at
// /app/visitors/[id]/confirm?action=approve|reject. Use ConfirmCheckinForm
// from confirm-checkin-form.tsx instead. The old modal remains as a no-op
// export so any straggling imports keep compiling until cleanup.
import type { CheckinConfirmAction } from "@/types/checkin";

interface ConfirmCheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkinId: string;
  visitorName: string;
  defaultAction: CheckinConfirmAction;
  onApproved?: (badge: {
    badgeQrToken: string;
    badgePdfBase64?: string;
  }) => void;
}

/**
 * @deprecated Navigate to `/app/visitors/{checkinId}/confirm?action=approve|reject`
 * instead. Rendering this component now produces nothing.
 */
export function ConfirmCheckinModal(_props: ConfirmCheckinModalProps) {
  void _props;
  return null;
}
