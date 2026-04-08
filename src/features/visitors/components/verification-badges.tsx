import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldX,
  ScanLine,
  Upload,
  UserCheck,
  XCircle,
  LogOut,
  Ban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import type {
  VisitStatus,
  VerificationStatus,
  VerificationMethod,
} from "@/types/enums";

// ── Visit Status Badge ──────────────────────────────────────────────

const VISIT_STATUS_CONFIG: Record<
  VisitStatus,
  { label: string; variant: BadgeProps["variant"]; icon: React.ElementType }
> = {
  registered: {
    label: "Registered",
    variant: "info",
    icon: Clock,
  },
  pending_verification: {
    label: "Pending Verification",
    variant: "warning",
    icon: Clock,
  },
  checked_in: {
    label: "Checked In",
    variant: "success",
    icon: CheckCircle2,
  },
  checked_out: {
    label: "Checked Out",
    variant: "secondary",
    icon: LogOut,
  },
  denied: {
    label: "Denied",
    variant: "destructive",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    variant: "outline",
    icon: Ban,
  },
};

interface VisitStatusBadgeProps {
  status: VisitStatus;
  className?: string;
}

export function VisitStatusBadge({ status, className }: VisitStatusBadgeProps) {
  const config = VISIT_STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

// ── Verification Status Badge ───────────────────────────────────────

const VERIFICATION_STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; variant: BadgeProps["variant"]; icon: React.ElementType }
> = {
  verified: {
    label: "Verified",
    variant: "success",
    icon: ShieldCheck,
  },
  unverified: {
    label: "Unverified",
    variant: "outline",
    icon: Clock,
  },
  denied: {
    label: "Denied",
    variant: "destructive",
    icon: ShieldX,
  },
};

interface VerificationBadgeProps {
  status: VerificationStatus;
  method?: VerificationMethod;
  className?: string;
}

export function VerificationBadge({
  status,
  method,
  className,
}: VerificationBadgeProps) {
  const config = VERIFICATION_STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {config.label}
      {method && (
        <span className="ml-1 opacity-75">
          ({formatMethod(method)})
        </span>
      )}
    </Badge>
  );
}

// ── Verification Method Badge ───────────────────────────────────────

const VERIFICATION_METHOD_CONFIG: Record<
  VerificationMethod,
  { label: string; icon: React.ElementType }
> = {
  id_scan: {
    label: "ID Scan",
    icon: ScanLine,
  },
  qr_upload: {
    label: "QR Upload",
    icon: Upload,
  },
  host_approval: {
    label: "Host Approval",
    icon: UserCheck,
  },
};

function formatMethod(method: VerificationMethod): string {
  return VERIFICATION_METHOD_CONFIG[method]?.label ?? method.replace(/_/g, " ");
}

interface VerificationMethodBadgeProps {
  method: VerificationMethod;
  className?: string;
}

export function VerificationMethodBadge({
  method,
  className,
}: VerificationMethodBadgeProps) {
  const config = VERIFICATION_METHOD_CONFIG[method];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={className}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
