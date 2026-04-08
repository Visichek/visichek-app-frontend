"use client";

import { useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  UserPlus,
  UserMinus,
  MoreHorizontal,
  Globe,
  Monitor,
  Eye,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckInModal } from "@/features/visitors/components/check-in-modal";
import { CheckOutModal } from "@/features/visitors/components/check-out-modal";
import { ConfirmCheckInModal } from "@/features/visitors/components/confirm-check-in-modal";
import { DenyVisitorModal } from "@/features/visitors/components/deny-visitor-modal";
import { SessionDetailSheet } from "@/features/visitors/components/session-detail-sheet";
import { OcrVerificationModal } from "@/features/visitors/components/ocr-verification-modal";
import { VisitStatusBadge } from "@/features/visitors/components/verification-badges";
import {
  useActiveVisitors,
  useCheckOut,
  usePendingVisitorSessions,
} from "@/features/visitors/hooks/use-visitors";
import { formatDateTime } from "@/lib/utils/format-date";
import type { VisitSession } from "@/types/visitor";

type TabView = "active" | "pending";

// ── Origin Badge ────────────────────────────────────────────────────

function OriginBadge({ method }: { method?: string }) {
  if (method === "qr_registration") {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Globe className="h-3 w-3" aria-hidden="true" />
        Self-reg
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Monitor className="h-3 w-3" aria-hidden="true" />
      Staff
    </Badge>
  );
}

// ── Page Component ──────────────────────────────────────────────────

export default function VisitorsPage() {
  const { data: activeVisitors = [], isLoading: activeLoading } =
    useActiveVisitors();
  const { data: pendingSessions = [], isLoading: pendingLoading } =
    usePendingVisitorSessions();
  const checkOutMutation = useCheckOut();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabView>("active");

  // Modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [confirmCheckOutOpen, setConfirmCheckOutOpen] = useState(false);

  // Selected session for modals
  const [selectedSession, setSelectedSession] = useState<VisitSession | null>(
    null
  );
  const [selectedCheckOutId, setSelectedCheckOutId] = useState<string>("");

  // ── Handlers ──────────────────────────────────────────────────────

  const handleConfirmCheckIn = useCallback((session: VisitSession) => {
    setSelectedSession(session);
    setShowConfirmModal(true);
  }, []);

  const handleDenyVisitor = useCallback((session: VisitSession) => {
    setSelectedSession(session);
    setShowDenyModal(true);
  }, []);

  const handleViewDetails = useCallback((session: VisitSession) => {
    setSelectedSession(session);
    setShowDetailSheet(true);
  }, []);

  const handleStartOcrVerification = useCallback((session: VisitSession) => {
    setSelectedSession(session);
    setShowOcrModal(true);
  }, []);

  const handleCloseConfirmModal = useCallback((open: boolean) => {
    setShowConfirmModal(open);
    if (!open) setSelectedSession(null);
  }, []);

  const handleCloseDenyModal = useCallback((open: boolean) => {
    setShowDenyModal(open);
    if (!open) setSelectedSession(null);
  }, []);

  const handleCloseDetailSheet = useCallback((open: boolean) => {
    setShowDetailSheet(open);
    if (!open) setSelectedSession(null);
  }, []);

  const handleCloseOcrModal = useCallback((open: boolean) => {
    setShowOcrModal(open);
    if (!open) setSelectedSession(null);
  }, []);

  const handleCheckOutClick = useCallback((sessionId: string) => {
    setSelectedCheckOutId(sessionId);
    setConfirmCheckOutOpen(true);
  }, []);

  const handleConfirmCheckOut = async () => {
    try {
      await checkOutMutation.mutateAsync({
        sessionId: selectedCheckOutId,
        checkOutMethod: "manual",
      });
      setConfirmCheckOutOpen(false);
      setSelectedCheckOutId("");
    } catch {
      // Error handled by mutation hook
    }
  };

  // ── Active Visitors Columns ───────────────────────────────────────

  const activeVisitorsColumns: ColumnDef<VisitSession>[] = [
    {
      accessorKey: "visitorNameSnapshot",
      header: "Visitor Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.visitorNameSnapshot ||
            row.original.visitorProfileId ||
            "—"}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "departmentId",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.departmentId || "—"}
        </span>
      ),
    },
    {
      accessorKey: "checkedInAt",
      header: "Checked In",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.checkedInAt)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <VisitStatusBadge status={row.original.status} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleViewDetails(row.original)}
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              View Details
            </DropdownMenuItem>
            {row.original.status === "checked_in" && (
              <DropdownMenuItem
                onClick={() => handleCheckOutClick(row.original.id)}
              >
                <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
                Check Out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ── Pending Sessions Columns ──────────────────────────────────────

  const pendingSessionsColumns: ColumnDef<VisitSession>[] = [
    {
      accessorKey: "visitorNameSnapshot",
      header: "Visitor Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {row.original.visitorNameSnapshot ||
              row.original.visitorProfileId ||
              "—"}
          </span>
          <OriginBadge method={row.original.checkInMethod} />
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "departmentId",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.departmentId || "—"}
        </span>
      ),
    },
    {
      accessorKey: "checkedInAt",
      header: "Registered",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.checkedInAt)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <VisitStatusBadge status={row.original.status} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleViewDetails(row.original)}
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStartOcrVerification(row.original)}
            >
              <ScanLine className="mr-2 h-4 w-4" aria-hidden="true" />
              Scan ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleConfirmCheckIn(row.original)}
            >
              Confirm Check-In
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDenyVisitor(row.original)}
              className="text-destructive"
            >
              Deny Entry
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ── Mobile Card Renderers ─────────────────────────────────────────

  const mobileActiveCard = (visitor: VisitSession) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">
            {visitor.visitorNameSnapshot ||
              visitor.visitorProfileId ||
              "Visitor"}
          </p>
          <p className="text-xs text-muted-foreground">
            {visitor.departmentId || "—"}
          </p>
        </div>
        <VisitStatusBadge status={visitor.status} />
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Checked in: {formatDateTime(visitor.checkedInAt)}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleViewDetails(visitor)}
          className="flex-1 min-h-[44px]"
        >
          <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Details
        </Button>
        {visitor.status === "checked_in" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCheckOutClick(visitor.id)}
            className="flex-1 min-h-[44px]"
          >
            Check Out
          </Button>
        )}
      </div>
    </div>
  );

  const mobilePendingCard = (session: VisitSession) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium text-sm">
            {session.visitorNameSnapshot ||
              session.visitorProfileId ||
              "Visitor"}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {session.departmentId || "—"}
            </p>
            <OriginBadge method={session.checkInMethod} />
          </div>
        </div>
        <VisitStatusBadge status={session.status} />
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Registered: {formatDateTime(session.checkedInAt)}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleViewDetails(session)}
          className="min-h-[44px]"
        >
          <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Details
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={() => handleConfirmCheckIn(session)}
          className="flex-1 min-h-[44px]"
        >
          Confirm
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleDenyVisitor(session)}
          className="min-h-[44px]"
        >
          Deny
        </Button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="Manage visitor check-ins and sessions"
        actions={
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              onClick={() => setShowCheckInModal(true)}
              className="flex-1 md:flex-none min-h-[44px]"
            >
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Register Visitor
            </Button>
            <Button
              onClick={() => setShowCheckOutModal(true)}
              variant="outline"
              className="flex-1 md:flex-none min-h-[44px]"
            >
              <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
              Check Out
            </Button>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "pb-2 px-1 text-sm font-medium border-b-2 transition-colors",
            activeTab === "active"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Active Visitors
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "pb-2 px-1 text-sm font-medium border-b-2 transition-colors relative",
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Pending Check-ins
          {pendingSessions.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-semibold h-5 min-w-[20px] px-1.5">
              {pendingSessions.length}
            </span>
          )}
        </button>
      </div>

      {/* Active Visitors Tab */}
      {activeTab === "active" && (
        <DataTable
          columns={activeVisitorsColumns}
          data={activeVisitors}
          isLoading={activeLoading}
          searchKey="visitorNameSnapshot"
          searchPlaceholder="Search visitors..."
          pagination={true}
          pageSize={10}
          mobileCard={mobileActiveCard}
          emptyTitle="No active visitors"
          emptyDescription="Check in a visitor to see them appear here."
        />
      )}

      {/* Pending Check-ins Tab */}
      {activeTab === "pending" && (
        <DataTable
          columns={pendingSessionsColumns}
          data={pendingSessions}
          isLoading={pendingLoading}
          searchKey="visitorNameSnapshot"
          searchPlaceholder="Search pending visitors..."
          pagination={true}
          pageSize={10}
          mobileCard={mobilePendingCard}
          emptyTitle="No pending check-ins"
          emptyDescription="All visitors have been confirmed or denied."
        />
      )}

      {/* Modals */}
      <CheckInModal
        open={showCheckInModal}
        onOpenChange={setShowCheckInModal}
      />
      <CheckOutModal
        open={showCheckOutModal}
        onOpenChange={setShowCheckOutModal}
      />

      {selectedSession && (
        <>
          <ConfirmCheckInModal
            open={showConfirmModal}
            onOpenChange={handleCloseConfirmModal}
            sessionId={selectedSession.id}
            visitorName={
              selectedSession.visitorNameSnapshot ||
              selectedSession.visitorProfileId ||
              "Visitor"
            }
          />
          <DenyVisitorModal
            open={showDenyModal}
            onOpenChange={handleCloseDenyModal}
            sessionId={selectedSession.id}
            visitorName={
              selectedSession.visitorNameSnapshot ||
              selectedSession.visitorProfileId ||
              "Visitor"
            }
          />
          <SessionDetailSheet
            open={showDetailSheet}
            onOpenChange={handleCloseDetailSheet}
            session={selectedSession}
            onConfirmCheckIn={handleConfirmCheckIn}
            onDenyEntry={handleDenyVisitor}
            onStartOcrVerification={handleStartOcrVerification}
          />
          <OcrVerificationModal
            open={showOcrModal}
            onOpenChange={handleCloseOcrModal}
            sessionId={selectedSession.id}
            visitorName={
              selectedSession.visitorNameSnapshot ||
              selectedSession.visitorProfileId ||
              "Visitor"
            }
          />
        </>
      )}

      {/* Confirm Check Out Dialog */}
      <ConfirmDialog
        open={confirmCheckOutOpen}
        onOpenChange={setConfirmCheckOutOpen}
        title="Check Out Visitor"
        description="Are you sure you want to check out this visitor?"
        confirmLabel="Check Out"
        cancelLabel="Cancel"
        onConfirm={handleConfirmCheckOut}
        isLoading={checkOutMutation.isPending}
      />
    </div>
  );
}
