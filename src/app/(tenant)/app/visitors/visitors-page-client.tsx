"use client";

import {
  useState,
  useCallback,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  QrCode,
  Printer,
  Download,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckinStateBadge,
  CheckinDetailSheet,
  ConfirmCheckinModal,
} from "@/features/checkins";
import { useTenantCheckins } from "@/features/checkins/hooks";
import { useSession } from "@/hooks/use-session";
import { formatDateTime } from "@/lib/utils/format-date";
import type {
  CheckinConfirmAction,
  CheckinOut,
  CheckinState,
} from "@/types/checkin";

interface TabDef {
  id: CheckinState;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
}

const TABS: readonly TabDef[] = [
  {
    id: "pending_approval",
    label: "Pending approval",
    emptyTitle: "No pending check-ins",
    emptyDescription: "New submissions appear here automatically.",
  },
  {
    id: "approved",
    label: "Approved",
    emptyTitle: "No approved check-ins yet",
    emptyDescription:
      "Once you approve a pending check-in it will show up here.",
  },
  {
    id: "rejected",
    label: "Rejected",
    emptyTitle: "No rejected check-ins",
    emptyDescription: "Rejected check-ins will show here with their reason.",
  },
  {
    id: "checked_out",
    label: "Checked out",
    emptyTitle: "No checked-out visitors yet",
    emptyDescription:
      "Visitors appear here after their visit ends.",
  },
] as const;

function base64ToBlob(base64: string, mime: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}

function downloadBadgePdf(base64: string, visitorName: string) {
  const blob = base64ToBlob(base64, "application/pdf");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `badge-${visitorName.replace(/\s+/g, "-").toLowerCase() || "visitor"}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printBadgePdf(base64: string) {
  const blob = base64ToBlob(base64, "application/pdf");
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function VisitorsPageClient() {
  const { tenantId } = useSession();

  const [activeTab, setActiveTab] = useState<CheckinState>("pending_approval");
  const [switchingTo, setSwitchingTo] = useState<CheckinState | null>(null);
  const [isPending, startTransition] = useTransition();

  function switchTab(next: CheckinState) {
    if (next === activeTab) return;
    setSwitchingTo(next);
    startTransition(() => {
      setActiveTab(next);
      setSwitchingTo(null);
    });
  }

  const { data: checkins = [], isLoading } = useTenantCheckins(tenantId ?? undefined, {
    state: activeTab,
  });

  const { data: pendingForCount = [] } = useTenantCheckins(
    tenantId ?? undefined,
    { state: "pending_approval" }
  );
  const pendingCount = pendingForCount.length;

  const [selected, setSelected] = useState<CheckinOut | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] =
    useState<CheckinConfirmAction>("approve");

  const [badge, setBadge] = useState<{
    pdfBase64?: string;
    qrToken: string;
    visitorName: string;
  } | null>(null);

  const handleView = useCallback((checkin: CheckinOut) => {
    setSelected(checkin);
    setDetailOpen(true);
  }, []);

  const handleApprove = useCallback((checkin: CheckinOut) => {
    setSelected(checkin);
    setConfirmAction("approve");
    setDetailOpen(false);
    setConfirmOpen(true);
  }, []);

  const handleReject = useCallback((checkin: CheckinOut) => {
    setSelected(checkin);
    setConfirmAction("reject");
    setDetailOpen(false);
    setConfirmOpen(true);
  }, []);

  const handleApproved = useCallback(
    (approved: { badgeQrToken: string; badgePdfBase64?: string }) => {
      const name = selected?.visitor?.fullName || "Visitor";
      setBadge({
        pdfBase64: approved.badgePdfBase64,
        qrToken: approved.badgeQrToken,
        visitorName: name,
      });
    },
    [selected]
  );

  const visitorName = (row: CheckinOut) =>
    row.visitor?.fullName || "Unnamed visitor";

  const columns: ColumnDef<CheckinOut>[] = useMemo(
    () => [
      {
        accessorKey: "visitor.fullName",
        id: "visitorName",
        header: "Visitor",
        cell: ({ row }) => (
          <div className="flex items-center gap-3 min-w-0">
            {row.original.visitor?.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.original.visitor.portraitUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover border"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{visitorName(row.original)}</p>
              {row.original.visitor?.email && (
                <p className="text-xs text-muted-foreground truncate">
                  {row.original.visitor.email}
                </p>
              )}
            </div>
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "purpose.purpose",
        id: "purpose",
        header: "Purpose",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.purpose.purpose}</span>
        ),
      },
      {
        accessorKey: "verified",
        id: "verified",
        header: "ID",
        cell: ({ row }) =>
          row.original.verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not verified</span>
          ),
      },
      {
        accessorKey: "dateCreated",
        id: "dateCreated",
        header: "Submitted",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDateTime(row.original.dateCreated)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "state",
        id: "state",
        header: "Status",
        cell: ({ row }) => <CheckinStateBadge state={row.original.state} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const isPendingRow = row.original.state === "pending_approval";
          return (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 min-h-[44px] md:min-h-0"
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Open actions for this check-in
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleView(row.original)}>
                  <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                  View details
                </DropdownMenuItem>
                {isPendingRow && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleApprove(row.original)}
                    >
                      <CheckCircle2
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleReject(row.original)}
                      className="text-destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      Reject
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleView, handleApprove, handleReject]
  );

  const mobileCard = (checkin: CheckinOut): ReactNode => {
    const isPendingRow = checkin.state === "pending_approval";
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-3">
            {checkin.visitor?.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={checkin.visitor.portraitUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover border"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-full bg-muted"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {visitorName(checkin)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {checkin.purpose.purpose}
              </p>
            </div>
          </div>
          <CheckinStateBadge state={checkin.state} />
        </div>
        <div className="text-xs text-muted-foreground">
          Submitted {formatDateTime(checkin.dateCreated)}
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleView(checkin)}
                className="min-h-[44px]"
              >
                <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Details
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Open the full details for this check-in
            </TooltipContent>
          </Tooltip>
          {isPendingRow && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(checkin)}
                    className="flex-1 min-h-[44px]"
                  >
                    <CheckCircle2
                      className="mr-1 h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    Approve
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Let this visitor in and issue a badge
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(checkin)}
                    className="min-h-[44px]"
                  >
                    <XCircle
                      className="mr-1 h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    Reject
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Deny this visitor entry and notify their host
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="Review pending check-ins, approve or reject visitors, and see past activity."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                className="flex-1 md:flex-none min-h-[44px]"
              >
                <Link href="/app/visitors/qr">
                  <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
                  Registration QR
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Generate a QR code visitors can scan to self-register from their
              phone
            </TooltipContent>
          </Tooltip>
        }
      />

      <div
        className="flex gap-2 border-b overflow-x-auto"
        role="tablist"
        aria-label="Check-in states"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isSpinning = isPending && switchingTo === tab.id;
          const showPendingCount =
            tab.id === "pending_approval" && pendingCount > 0;
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchTab(tab.id)}
                  className={cn(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors relative whitespace-nowrap inline-flex items-center gap-1.5 min-h-[44px]",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isSpinning && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {tab.label}
                  {showPendingCount && (
                    <span
                      className="ml-1 inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-semibold h-5 min-w-[20px] px-1.5"
                      aria-label={`${pendingCount} pending`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {tab.id === "pending_approval"
                  ? "Check-ins awaiting your review"
                  : tab.id === "approved"
                    ? "Visitors you've let in"
                    : tab.id === "rejected"
                      ? "Check-ins you've denied and why"
                      : "Visitors whose visit has ended"}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {TABS.map((tab) => {
        if (tab.id !== activeTab) return null;
        return (
          <DataTable
            key={tab.id}
            columns={columns}
            data={checkins}
            isLoading={isLoading}
            searchKey="visitorName"
            searchPlaceholder="Search by visitor name..."
            pagination
            pageSize={10}
            mobileCard={mobileCard}
            emptyTitle={tab.emptyTitle}
            emptyDescription={tab.emptyDescription}
          />
        );
      })}

      <CheckinDetailSheet
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setSelected(null);
        }}
        checkin={selected}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {selected && (
        <ConfirmCheckinModal
          open={confirmOpen}
          onOpenChange={(next) => {
            setConfirmOpen(next);
          }}
          checkinId={selected.id}
          visitorName={visitorName(selected)}
          defaultAction={confirmAction}
          onApproved={handleApproved}
        />
      )}

      <AlertDialog
        open={!!badge}
        onOpenChange={(next) => {
          if (!next) setBadge(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Badge ready</AlertDialogTitle>
            <AlertDialogDescription>
              {badge?.visitorName} has been approved. Print or download their
              badge now, or close this dialog — you can always fetch the badge
              later from the check-in details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 md:flex-row">
            {badge?.pdfBase64 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() =>
                        badge.pdfBase64 &&
                        printBadgePdf(badge.pdfBase64)
                      }
                      className="min-h-[44px]"
                    >
                      <Printer
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Print badge
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Open the badge PDF and send it to your printer
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() =>
                        badge.pdfBase64 &&
                        downloadBadgePdf(
                          badge.pdfBase64,
                          badge.visitorName
                        )
                      }
                      className="min-h-[44px]"
                    >
                      <Download
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Download PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Save the badge as a PDF to your computer
                  </TooltipContent>
                </Tooltip>
              </>
            )}
            {!badge?.pdfBase64 && badge?.qrToken && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(badge.qrToken)
                        .then(() => toast.success("Token copied"))
                        .catch(() =>
                          toast.error("Couldn't copy to clipboard")
                        );
                    }}
                    className="min-h-[44px]"
                  >
                    Copy badge token
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Copy the badge QR token to share or paste into another
                  system
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="min-h-[44px]">Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setBadge(null)}
              className="min-h-[44px]"
            >
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
