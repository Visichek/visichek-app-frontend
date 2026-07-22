"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { BranchLabel } from "@/components/recipes/branch-label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAppointments,
  useDeleteAppointment,
  useBulkAppointmentAction,
} from "@/features/appointments/hooks/use-appointments";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useShowBranch } from "@/hooks/use-show-branch";
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

const APPOINTMENTS_PAGE_SIZE = 25;
type AppointmentStatusTab = "all" | "scheduled" | "fulfilled" | "missed" | "cancelled";
const APPOINTMENT_TABS: { value: AppointmentStatusTab; label: string; description: string }[] = [
  { value: "all", label: "All", description: "Show every appointment regardless of its current status" },
  { value: "scheduled", label: "Scheduled", description: "Upcoming appointments that haven't happened yet" },
  { value: "fulfilled", label: "Fulfilled", description: "Appointments where the visitor showed up and checked in" },
  { value: "missed", label: "Missed", description: "Appointments the visitor never showed up for" },
  { value: "cancelled", label: "Cancelled", description: "Appointments that were cancelled before they happened" },
];

export function AppointmentsPageClient() {
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.APPOINTMENT_CREATE);
  // Issue 3: replace the hard-coded role string with the capability so
  // dept_admin sees the "Configure form" entry too, while receptionist
  // and lower roles no longer do. Backend permission dependency is
  // authoritative; this is the UI-visibility half.
  const canConfigureForms = hasCapability(CAPABILITIES.TENANT_FORM_CONFIGURE);
  // Show the Branch column only for unscoped roles (or multi-branch users);
  // a single-branch user's rows all match, so the label would be noise.
  const showBranch = useShowBranch();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [statusTab, setStatusTab] = useState<AppointmentStatusTab>("all");
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [statusTab]);

  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * APPOINTMENTS_PAGE_SIZE,
      limit: APPOINTMENTS_PAGE_SIZE,
      sort: "-scheduledDatetime",
      facets: "status",
    };
    if (statusTab !== "all") params.status = statusTab;
    return params;
  }, [pageIndex, statusTab]);

  const { data: appointmentsList, isLoading } = useAppointments(listFilters);
  // Department rows carry only `departmentId`; map id → name so the table
  // shows a readable label instead of the raw ObjectId.
  const { data: departmentsList } = useDepartments({ skip: 0, limit: 200 });
  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const dept of departmentsList?.items ?? []) {
      if (dept.id) map.set(dept.id, dept.name);
    }
    return map;
  }, [departmentsList]);
  const departmentLabel = useCallback(
    (id: string | null | undefined) =>
      (id && (departmentNameById.get(id) ?? id)) || "—",
    [departmentNameById],
  );
  const appointments = appointmentsList?.items ?? [];
  const meta = appointmentsList?.meta;
  const statusFacet = meta?.facets?.status ?? {};
  const tabCounts: Record<AppointmentStatusTab, number> = {
    all: statusFacet.all ?? meta?.total ?? 0,
    scheduled: statusFacet.scheduled ?? 0,
    fulfilled: statusFacet.fulfilled ?? 0,
    missed: statusFacet.missed ?? 0,
    cancelled: statusFacet.cancelled ?? 0,
  };
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
        <span className="text-muted-foreground text-sm">{departmentLabel(row.original.departmentId)}</span>
      ),
    },
    ...(showBranch
      ? [
          {
            id: "branch",
            header: "Branch",
            cell: ({ row }) => (
              <BranchLabel branch={row.original.branchSummary} />
            ),
          } as ColumnDef<Appointment>,
        ]
      : []),
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
          {appointment.departmentId && (
            <p>Department: {departmentLabel(appointment.departmentId)}</p>
          )}
          {showBranch && appointment.branchSummary?.name && (
            <p>Branch: {appointment.branchSummary.name}</p>
          )}
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
                  Open the organization form builder to configure appointment booking fields
                </TooltipContent>
              </Tooltip>
            ) : null}
            {canCreate ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavButton
                    href="/app/appointments/new"
                    className="w-full md:w-auto min-h-[44px]"
                    data-tutorial-anchor="appointments-new-button"
                  >
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

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as AppointmentStatusTab)}
      >
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {APPOINTMENT_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-[44px]"
              title={tab.description}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
                {tabCounts[tab.value].toLocaleString()}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={appointments}
        isLoading={isLoading}
        searchKey="visitorNameSnapshot"
        searchPlaceholder="Search appointments..."
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: APPOINTMENTS_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        mobileCard={mobileCard}
        emptyTitle="No appointments"
        emptyDescription="Schedule an appointment to get started."
        selectable
        getRowId={(appt) => appt.id}
        itemNoun="appointment"
        bulkActions={bulkActions}
        getRowHref={(appt) => `/app/appointments/${appt.id}/edit`}
        rowClickAriaLabel={(appt) =>
          `View details for appointment with ${appt.visitorNameSnapshot ?? "visitor"}`
        }
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
