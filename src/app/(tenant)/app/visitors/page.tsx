"use client";

import { useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { UserPlus, UserMinus, MoreHorizontal } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckInModal } from "@/features/visitors/components/check-in-modal";
import { CheckOutModal } from "@/features/visitors/components/check-out-modal";
import { ConfirmCheckInModal } from "@/features/visitors/components/confirm-check-in-modal";
import { DenyVisitorModal } from "@/features/visitors/components/deny-visitor-modal";
import {
  useActiveVisitors,
  useCheckOut,
  usePendingVisitorSessions,
} from "@/features/visitors/hooks/use-visitors";
import { formatDateTime } from "@/lib/utils/format-date";
import type { VisitSession } from "@/types/visitor";
import type { VisitStatus } from "@/types/enums";

function statusVariant(status: VisitStatus) {
  switch (status) {
    case "checked_in":
      return "success" as const;
    case "checked_out":
      return "secondary" as const;
    case "registered":
    case "pending_verification":
      return "warning" as const;
    case "denied":
      return "destructive" as const;
    case "cancelled":
      return "outline" as const;
    default:
      return "default" as const;
  }
}

type TabView = "active" | "pending";

export default function VisitorsPage() {
  const { data: activeVisitors = [], isLoading: activeLoading } = useActiveVisitors();
  const { data: pendingSessions = [], isLoading: pendingLoading } = usePendingVisitorSessions();
  const checkOutMutation = useCheckOut();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabView>("active");

  // Modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [confirmCheckOutOpen, setConfirmCheckOutOpen] = useState(false);

  // Selected session for modals
  const [selectedSession, setSelectedSession] = useState<VisitSession | null>(null);
  const [selectedCheckOutId, setSelectedCheckOutId] = useState<string>("");

  // Handle confirm check-in
  const handleConfirmCheckIn = useCallback((session: VisitSession) => {
    setSelectedSession(session);
    setShowConfirmModal(true);
  }, []);

  // Handle deny visitor
  const handleDenyVisitor = useCallback((session: VisitSession) => {
    setSelectedSession(session);
    setShowDenyModal(true);
  }, []);

  // Close modals and clear selection
  const handleCloseConfirmModal = useCallback((open: boolean) => {
    setShowConfirmModal(open);
    if (!open) {
      setSelectedSession(null);
    }
  }, []);

  const handleCloseDenyModal = useCallback((open: boolean) => {
    setShowDenyModal(open);
    if (!open) {
      setSelectedSession(null);
    }
  }, []);

  // Handle check out click
  const handleCheckOutClick = useCallback((sessionId: string) => {
    setSelectedCheckOutId(sessionId);
    setConfirmCheckOutOpen(true);
  }, []);

  // Confirm check out
  const handleConfirmCheckOut = async () => {
    try {
      await checkOutMutation.mutateAsync({
        session_id: selectedCheckOutId,
        check_out_method: "manual",
      });
      setConfirmCheckOutOpen(false);
      setSelectedCheckOutId("");
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  // Active Visitors columns
  const activeVisitorsColumns: ColumnDef<VisitSession>[] = [
    {
      accessorKey: "visitor_name_snapshot",
      header: "Visitor Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.visitor_name_snapshot || row.original.visitor_profile_id || "—"}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "company",
      header: "Company",
      cell: ({ row }) => {
        // Note: company field may not exist on VisitSession; adjust as needed
        return <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      accessorKey: "department_id",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.department_id || "—"}</span>
      ),
    },
    {
      accessorKey: "checked_in_at",
      header: "Checked In",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.checked_in_at)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
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
            {row.original.status === "checked_in" && (
              <DropdownMenuItem onClick={() => handleCheckOutClick(row.original.id)}>
                Check Out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Pending Sessions columns
  const pendingSessionsColumns: ColumnDef<VisitSession>[] = [
    {
      accessorKey: "visitor_name_snapshot",
      header: "Visitor Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.visitor_name_snapshot || row.original.visitor_profile_id || "—"}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {/* Phone may not be directly on VisitSession; check backend */}
          —
        </span>
      ),
    },
    {
      accessorKey: "department_id",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.department_id || "—"}</span>
      ),
    },
    {
      accessorKey: "checked_in_at",
      header: "Registered",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.checked_in_at)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
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
            <DropdownMenuItem onClick={() => handleConfirmCheckIn(row.original)}>
              Confirm Check-In
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDenyVisitor(row.original)}>
              Deny Entry
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              Edit Draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Mobile card renderers
  const mobileActiveCard = (visitor: VisitSession) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">
            {visitor.visitor_name_snapshot || visitor.visitor_profile_id || "Visitor"}
          </p>
          <p className="text-xs text-muted-foreground">{visitor.department_id || "—"}</p>
        </div>
        <Badge variant={statusVariant(visitor.status)}>
          {visitor.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Checked in: {formatDateTime(visitor.checked_in_at)}</p>
      </div>
      {visitor.status === "checked_in" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleCheckOutClick(visitor.id)}
          className="w-full"
        >
          Check Out
        </Button>
      )}
    </div>
  );

  const mobilePendingCard = (session: VisitSession) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">
            {session.visitor_name_snapshot || session.visitor_profile_id || "Visitor"}
          </p>
          <p className="text-xs text-muted-foreground">{session.department_id || "—"}</p>
        </div>
        <Badge variant={statusVariant(session.status)}>
          {session.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Registered: {formatDateTime(session.checked_in_at)}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => handleConfirmCheckIn(session)}
          className="flex-1"
        >
          Confirm
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleDenyVisitor(session)}
          className="flex-1"
        >
          Deny
        </Button>
      </div>
    </div>
  );

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
            "pb-2 px-1 text-sm font-medium border-b-2 transition-colors",
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Pending Check-ins ({pendingSessions.length})
        </button>
      </div>

      {/* Active Visitors Tab */}
      {activeTab === "active" && (
        <DataTable
          columns={activeVisitorsColumns}
          data={activeVisitors}
          isLoading={activeLoading}
          searchKey="visitor_name_snapshot"
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
          searchKey="visitor_name_snapshot"
          searchPlaceholder="Search pending visitors..."
          pagination={true}
          pageSize={10}
          mobileCard={mobilePendingCard}
          emptyTitle="No pending check-ins"
          emptyDescription="All visitors have been confirmed or denied."
        />
      )}

      {/* Modals */}
      <CheckInModal open={showCheckInModal} onOpenChange={setShowCheckInModal} />
      <CheckOutModal open={showCheckOutModal} onOpenChange={setShowCheckOutModal} />

      {selectedSession && (
        <>
          <ConfirmCheckInModal
            open={showConfirmModal}
            onOpenChange={handleCloseConfirmModal}
            sessionId={selectedSession.id}
            visitorName={selectedSession.visitor_name_snapshot || selectedSession.visitor_profile_id || "Visitor"}
          />
          <DenyVisitorModal
            open={showDenyModal}
            onOpenChange={handleCloseDenyModal}
            sessionId={selectedSession.id}
            visitorName={selectedSession.visitor_name_snapshot || selectedSession.visitor_profile_id || "Visitor"}
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
