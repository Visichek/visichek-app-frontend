"use client";

import { useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
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
import { AppointmentFormModal } from "@/features/appointments/components/appointment-form-modal";
import {
  useAppointments,
  useDeleteAppointment,
} from "@/features/appointments/hooks/use-appointments";
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

export default function AppointmentsPage() {
  const { data: appointments = [], isLoading, isError, refetch } = useAppointments();
  const deleteAppointmentMutation = useDeleteAppointment();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | undefined>(
    undefined
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string>("");

  const handleEditAppointment = useCallback((appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setFormModalOpen(true);
  }, []);

  const handleCreateAppointment = useCallback(() => {
    setSelectedAppointment(undefined);
    setFormModalOpen(true);
  }, []);

  const handleFormModalClose = useCallback((open: boolean) => {
    if (!open) {
      setSelectedAppointment(undefined);
    }
    setFormModalOpen(open);
  }, []);

  const handleDeleteClick = useCallback((appointmentId: string) => {
    setAppointmentToDelete(appointmentId);
    setConfirmDeleteOpen(true);
  }, []);

  const handleConfirmDelete = async () => {
    try {
      await deleteAppointmentMutation.mutateAsync(appointmentToDelete);
      setConfirmDeleteOpen(false);
      setAppointmentToDelete("");
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "visitor_name_snapshot",
      header: "Visitor",
      cell: ({ row }) => (
        <span className="font-medium text-sm">{row.original.visitor_name_snapshot || "—"}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "host_name_snapshot",
      header: "Host",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.host_name_snapshot || "—"}</span>
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
      accessorKey: "scheduled_datetime",
      header: "Scheduled",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.scheduled_datetime)}
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
            <DropdownMenuItem onClick={() => handleEditAppointment(row.original)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteClick(row.original.id)}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const mobileCard = (appointment: Appointment) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium text-sm">{appointment.visitor_name_snapshot || "Visitor"}</p>
          <p className="text-xs text-muted-foreground">
            with {appointment.host_name_snapshot || "Host"}
          </p>
        </div>
        <Badge variant={statusVariant(appointment.status)}>
          {appointment.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Scheduled: {formatDateTime(appointment.scheduled_datetime)}</p>
        {appointment.department_id && <p>Department: {appointment.department_id}</p>}
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleEditAppointment(appointment)}
          className="flex-1"
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDeleteClick(appointment.id)}
          className="flex-1 text-destructive"
        >
          Delete
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Scheduled and past appointments"
        actions={
          <Button
            onClick={handleCreateAppointment}
            className="w-full md:w-auto min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Appointment
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={appointments}
        isLoading={isLoading}
        searchKey="visitor_name_snapshot"
        searchPlaceholder="Search appointments..."
        pagination={true}
        pageSize={10}
        mobileCard={mobileCard}
        emptyTitle="No appointments"
        emptyDescription="Schedule an appointment to get started."
      />

      {/* Appointment Form Modal */}
      <AppointmentFormModal
        open={formModalOpen}
        onOpenChange={handleFormModalClose}
        appointment={selectedAppointment}
      />

      {/* Confirm Delete Dialog */}
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
    </div>
  );
}
