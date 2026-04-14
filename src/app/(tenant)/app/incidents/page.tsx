"use client";

import { useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IncidentFormModal } from "@/features/incidents/components/incident-form-modal";
import { useIncidents, useApproachingDeadlineIncidents, useUpdateIncident } from "@/features/incidents/hooks/use-incidents";
import { formatDateTime } from "@/lib/utils/format-date";
import { useActionParam } from "@/hooks/use-action-param";
import { toast } from "sonner";
import type { Incident } from "@/types/incident";
import type { IncidentStatus } from "@/types/enums";

function statusVariant(status: IncidentStatus) {
  switch (status) {
    case "open":
      return "destructive" as const;
    case "investigating":
      return "warning" as const;
    case "contained":
      return "info" as const;
    case "reported_to_ndpc":
      return "secondary" as const;
    case "closed":
      return "success" as const;
  }
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function IncidentsPage() {
  const { data: incidentsResponse, isLoading, isError, refetch } = useIncidents();
  const { data: deadlineResponse } = useApproachingDeadlineIncidents();

  const incidents = Array.isArray(incidentsResponse)
    ? incidentsResponse
    : incidentsResponse?.data || [];

  const deadlineIncidents = Array.isArray(deadlineResponse)
    ? deadlineResponse
    : deadlineResponse?.data || [];

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | undefined>(undefined);
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);

  const handleEditIncident = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
    setFormModalOpen(true);
  }, []);

  const handleCreateIncident = useCallback(() => {
    setSelectedIncident(undefined);
    setFormModalOpen(true);
  }, []);

  // Open create modal when navigated from a "Quick Action" card.
  useActionParam({
    create: handleCreateIncident,
  });

  const handleFormModalClose = useCallback((open: boolean) => {
    if (!open) {
      setSelectedIncident(undefined);
    }
    setFormModalOpen(open);
  }, []);

  const handleMarkAsNotified = useCallback((incident: Incident) => {
    setPendingNotificationId(incident.id);
    const updateIncidentMutation = useUpdateIncident(incident.id);

    updateIncidentMutation.mutate(
      {
        ndpcNotified: true,
        notificationSentAt: Math.floor(Date.now() / 1000),
      },
      {
        onSuccess: () => {
          toast.success("Incident marked as notified to NDPC");
          setPendingNotificationId(null);
          refetch();
        },
        onError: (error) => {
          toast.error("Failed to update incident");
          setPendingNotificationId(null);
        },
      }
    );
  }, [refetch]);

  const columns: ColumnDef<Incident>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.title}</span>,
      enableSorting: true,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatType(row.original.type)}
        </span>
      ),
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
      accessorKey: "createdAt",
      header: "Reported",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "notificationDeadline",
      header: "NDPC Deadline",
      cell: ({ row }) => {
        if (!row.original.notificationDeadline) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        const deadline = row.original.notificationDeadline * 1000;
        const now = Date.now();
        const hoursRemaining = Math.floor((deadline - now) / (1000 * 60 * 60));

        return (
          <span className={`text-sm ${hoursRemaining < 24 ? "font-medium text-warning" : "text-muted-foreground"}`}>
            {hoursRemaining > 0 ? `in ${hoursRemaining}h` : "overdue"}
          </span>
        );
      },
    },
    {
      accessorKey: "ndpcNotified",
      header: "NDPC Status",
      cell: ({ row }) => (
        <Badge variant={row.original.ndpcNotified ? "success" : "warning"}>
          {row.original.ndpcNotified ? "Notified" : "Pending"}
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
            <DropdownMenuItem onClick={() => handleEditIncident(row.original)}>
              View / Edit
            </DropdownMenuItem>
            {!row.original.ndpcNotified && (
              <DropdownMenuItem
                onClick={() => handleMarkAsNotified(row.original)}
                disabled={pendingNotificationId === row.original.id}
              >
                {pendingNotificationId === row.original.id ? "Marking..." : "Mark as Notified"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const mobileCard = (incident: Incident) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium text-sm">{incident.title}</p>
          <p className="text-xs text-muted-foreground">{formatType(incident.type)}</p>
        </div>
        <Badge variant={statusVariant(incident.status)}>
          {incident.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {formatDateTime(incident.createdAt)}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleEditIncident(incident)}
        className="w-full"
      >
        View / Edit
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Security incident tracking and response"
        actions={
          <Button
            onClick={handleCreateIncident}
            className="w-full md:w-auto min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Report Incident
          </Button>
        }
      />

      {deadlineIncidents.length > 0 && (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning">NDPC Notification Deadline Approaching</p>
            <p className="text-sm text-muted-foreground mt-1">
              {deadlineIncidents.length} incident{deadlineIncidents.length !== 1 ? "s" : ""} {deadlineIncidents.length !== 1 ? "are" : "is"} within 24 hours of the 72-hour NDPC notification deadline.
            </p>
            <ul className="mt-2 space-y-1">
              {deadlineIncidents.map((inc) => (
                <li key={inc.id} className="text-sm">
                  • <strong>{inc.title}</strong> — deadline: {inc.notificationDeadline ? formatDateTime(inc.notificationDeadline) : "N/A"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={incidents}
        isLoading={isLoading}
        searchKey="title"
        searchPlaceholder="Search incidents..."
        pagination={true}
        pageSize={10}
        mobileCard={mobileCard}
        emptyTitle="No incidents"
        emptyDescription="No security incidents have been reported."
      />

      {/* Incident Form Modal */}
      <IncidentFormModal
        open={formModalOpen}
        onOpenChange={handleFormModalClose}
        incident={selectedIncident}
      />
    </div>
  );
}
