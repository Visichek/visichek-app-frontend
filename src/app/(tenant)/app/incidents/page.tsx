"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  AlertTriangle,
  Edit2,
  Loader2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  useIncidents,
  useApproachingDeadlineIncidents,
} from "@/features/incidents/hooks/use-incidents";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { apiPatch } from "@/lib/api/request";
import { formatDateTime } from "@/lib/utils/format-date";
import { toast } from "sonner";
import type { Incident, UpdateIncidentRequest } from "@/types/incident";
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
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.INCIDENT_CREATE);
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const {
    data: incidentsResponse,
    isLoading,
    refetch,
  } = useIncidents();
  const { data: deadlineResponse } = useApproachingDeadlineIncidents();

  const queryClient = useQueryClient();
  const markNotifiedMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateIncidentRequest;
    }) => apiPatch<Incident>(`/incidents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  const incidents = Array.isArray(incidentsResponse)
    ? incidentsResponse
    : incidentsResponse?.data || [];

  const deadlineIncidents = Array.isArray(deadlineResponse)
    ? deadlineResponse
    : deadlineResponse?.data || [];

  const [pendingNotificationId, setPendingNotificationId] = useState<
    string | null
  >(null);

  const handleMarkAsNotified = useCallback(
    (incident: Incident) => {
      setPendingNotificationId(incident.id);
      markNotifiedMutation.mutate(
        {
          id: incident.id,
          data: {
            ndpcNotified: true,
            notificationSentAt: Math.floor(Date.now() / 1000),
          },
        },
        {
          onSuccess: () => {
            toast.success("Incident marked as notified to NDPC");
            setPendingNotificationId(null);
            refetch();
          },
          onError: () => {
            toast.error("Failed to update incident");
            setPendingNotificationId(null);
          },
        },
      );
    },
    [markNotifiedMutation, refetch],
  );

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
          <span
            className={`text-sm ${
              hoursRemaining < 24
                ? "font-medium text-warning"
                : "text-muted-foreground"
            }`}
          >
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
        <RowActions
          incident={row.original}
          onMarkNotified={handleMarkAsNotified}
          pendingNotificationId={pendingNotificationId}
          loadingHref={loadingHref}
          handleNavClick={handleNavClick}
        />
      ),
    },
  ];

  const mobileCard = (incident: Incident) => {
    const editHref = `/app/incidents/${incident.id}/edit`;
    const isLoadingEdit = loadingHref === editHref;
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-medium text-sm">{incident.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatType(incident.type)}
            </p>
          </div>
          <Badge variant={statusVariant(incident.status)}>
            {incident.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDateTime(incident.createdAt)}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" asChild className="w-full min-h-[44px]">
              <Link href={editHref} onClick={() => handleNavClick(editHref)}>
                {isLoadingEdit ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Edit2 className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                View / Edit
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Open this incident&apos;s edit form</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Security incident tracking and response"
        actions={
          canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild className="w-full md:w-auto min-h-[44px]">
                  <Link
                    href="/app/incidents/new"
                    onClick={() => handleNavClick("/app/incidents/new")}
                  >
                    {loadingHref === "/app/incidents/new" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Report Incident
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the incident reporting form to log a new incident
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      />

      {deadlineIncidents.length > 0 && (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning">
              NDPC Notification Deadline Approaching
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {deadlineIncidents.length} incident
              {deadlineIncidents.length !== 1 ? "s" : ""}{" "}
              {deadlineIncidents.length !== 1 ? "are" : "is"} within 24 hours of
              the 72-hour NDPC notification deadline.
            </p>
            <ul className="mt-2 space-y-1">
              {deadlineIncidents.map((inc) => (
                <li key={inc.id} className="text-sm">
                  • <strong>{inc.title}</strong> — deadline:{" "}
                  {inc.notificationDeadline
                    ? formatDateTime(inc.notificationDeadline)
                    : "N/A"}
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
    </div>
  );
}

function RowActions({
  incident,
  onMarkNotified,
  pendingNotificationId,
  loadingHref,
  handleNavClick,
}: {
  incident: Incident;
  onMarkNotified: (i: Incident) => void;
  pendingNotificationId: string | null;
  loadingHref: string | null;
  handleNavClick: (href: string) => void;
}) {
  const editHref = `/app/incidents/${incident.id}/edit`;
  const isLoadingEdit = loadingHref === editHref;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open menu</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Open actions for this incident
          </TooltipContent>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link
            href={editHref}
            onClick={() => handleNavClick(editHref)}
            className="flex items-center"
          >
            {isLoadingEdit ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Edit2 className="mr-2 h-4 w-4" />
            )}
            View / Edit
          </Link>
        </DropdownMenuItem>
        {!incident.ndpcNotified && (
          <DropdownMenuItem
            onClick={() => onMarkNotified(incident)}
            disabled={pendingNotificationId === incident.id}
          >
            {pendingNotificationId === incident.id
              ? "Marking..."
              : "Mark as Notified"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
