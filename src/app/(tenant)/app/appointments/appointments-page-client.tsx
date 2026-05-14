"use client";

import { useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  Loader2,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable, type DataTableBulkAction } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { NavButton } from "@/components/recipes/nav-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
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
  useAppointments,
  useDeleteAppointment,
  useBulkAppointmentAction,
} from "@/features/appointments/hooks/use-appointments";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useSession } from "@/hooks/use-session";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { formatDateTime } from "@/lib/utils/format-date";
import type { Appointment } from "@/types/visitor";
import type { AppointmentStatus } from "@/types/enums";

function statusVariant(status: AppointmentStatus) {
  switch (status) {
    case "scheduled":
      return "info" as const;
    case "fulfilled":
      return "success" as const;
    case "cancelled":
      return "secondary" as const;
    case "missed":
      return "warning" as const;
  }
}

export function AppointmentsPageClient() {
  const { hasCapability } = useCapabilities();
  const { currentRole } = useSession();
  const canCreate = hasCapability(CAPABILITIES.APPOINTMENT_CREATE);
  const canConfigureForms = currentRole === "super_admin";
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const { data: appointmentsList, isLoading } = useAppointments({ limit: 100, sort: "-scheduledDatetime" });
  const appointments = appointmentsList?.items ?? [];
  const deleteAppointmentMutation = useDeleteAppointment();
  const bulkDeleteAppointments = useBulkAppointmentAction("delete");

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string>("");
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  async function handleBulkDeleteConfirm() {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setBulkPending(true);
    try {
      const result = await bulkDeleteAppointments.mutateAsync({ ids: bulkDeleteIds });
      const { tone, message } = summarizeBulkResult(result, "appointment", "deleted");
      toast[tone](message);
      setBulkDeleteIds(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk delete failed");
    } finally {
      setBulkPending(false);
    }
  }

  const bulkActions: DataTableBulkAction<Appointment>[] = [
    {
      label: "Delete",
      description: "Permanently delete every selected appointment — this cannot be undone",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (ids) => {
        if (ids.length > 0) setBulkDeleteIds(ids);
      },
    },
  ];

  const handleDeleteClick = useCallback((appointmentId: string) => {
    setAppointmentToDelete(appointmentId);
    setConfirmDeleteOpen(true);
  }, []);

  const handleConfirmDelete = async () => {
    try {
      await deleteAppointmentMutation.mutateAsync(appointmentToDelete);
      setConfirmDeleteOpen(false);
      setAppointmentToDelete("");
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "visitorNameSnapshot",
      header: "Visitor",
      cell: ({ row }) => (
        <span className="font-medium text-sm">{row.original.visitorNameSnapshot || "—"}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "hostNameSnapshot",
      header: "Host",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.hostNameSnapshot || "—"}</span>
      ),
    },
    {
      accessorKey: "departmentId",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.departmentId || "—"}</span>
      ),
    },
    {
      accessorKey: "scheduledDatetime",
      header: "Scheduled",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.scheduledDatetime)}
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
        <RowActions
          appointment={row.original}
          onDelete={handleDeleteClick}
        />
      ),
    },
  ];

  const mobileCard = (appointment: Appointment) => {
    const editHref = `/app/appointments/${appointment.id}/edit`;
    const isLoadingEdit = loadingHref === editHref;
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-medium text-sm">
              {appointment.visitorNameSnapshot || "Visitor"}
            </p>
            <p className="text-xs text-muted-foreground">
              with {appointment.hostNameSnapshot || "Host"}
            </p>
          </div>
          <Badge variant={statusVariant(appointment.status)}>
            {appointment.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Scheduled: {formatDateTime(appointment.scheduledDatetime)}</p>
          {appointment.departmentId && <p>Department: {appointment.departmentId}</p>}
        </div>
        <div className="flex gap-2 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton href={editHref} size="sm" variant="outline" className="flex-1 min-h-[44px]">
                {isLoadingEdit ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Edit2 className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Edit
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="top">Open this appointment&apos;s edit form</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteClick(appointment.id)}
                className="flex-1 text-destructive min-h-[44px]"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Delete this appointment</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Scheduled and past appointments"
        actions={
          <div className="flex flex-col gap-2 md:flex-row">
            {canConfigureForms ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavButton
                    href="/app/settings/forms?target=appointment"
                    variant="outline"
                    className="w-full min-h-[44px] md:w-auto"
                  >
                    {loadingHref === "/app/settings/forms?target=appointment" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Configure form
                  </NavButton>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Open the tenant form builder to configure appointment booking fields
                </TooltipContent>
              </Tooltip>
            ) : null}
            {canCreate ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavButton href="/app/appointments/new" className="w-full md:w-auto min-h-[44px]">
                    {loadingHref === "/app/appointments/new" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    New Appointment
                  </NavButton>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Open the scheduling form to create a new appointment
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={appointments}
        isLoading={isLoading}
        searchKey="visitorNameSnapshot"
        searchPlaceholder="Search appointments..."
        pagination={true}
        pageSize={10}
        mobileCard={mobileCard}
        emptyTitle="No appointments"
        emptyDescription="Schedule an appointment to get started."
        selectable
        getRowId={(appt) => appt.id}
        itemNoun="appointment"
        bulkActions={bulkActions}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Appointment"
        description="Are you sure you want to delete this appointment? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        isLoading={deleteAppointmentMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteIds !== null}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteIds(null);
        }}
        title={`Delete ${bulkDeleteIds?.length ?? 0} appointment${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}`}
        description={`Permanently delete ${bulkDeleteIds?.length ?? 0} appointment${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={bulkPending}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
}

function RowActions({
  appointment,
  onDelete,
}: {
  appointment: Appointment;
  onDelete: (id: string) => void;
}) {
  const editHref = `/app/appointments/${appointment.id}/edit`;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          Open actions for this appointment
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuNavItem
          href={editHref}
          label="Edit"
          icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
        />
        <DropdownMenuItem
          onClick={() => onDelete(appointment.id)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
