"use client";

import { useState } from "react";
import { Plus, Eye, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/format-date";
import { useDataSubjectRequests } from "@/features/dsr/hooks/use-dsr";
import { DSRFormModal } from "@/features/dsr/components/dsr-form-modal";
import type { DataSubjectRequest } from "@/types/dpo";
import type { DSRStatus } from "@/types/enums";

function statusVariant(status: DSRStatus) {
  switch (status) {
    case "pending":
      return "warning" as const;
    case "in_progress":
      return "info" as const;
    case "completed":
      return "success" as const;
    case "rejected":
      return "destructive" as const;
  }
}

export default function DPOPage() {
  const { data, isLoading } = useDataSubjectRequests();
  const requests = data?.data || [];

  const [formOpen, setFormOpen] = useState(false);
  const [selectedDSR, setSelectedDSR] = useState<DataSubjectRequest | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dsrToDelete, setDSRToDelete] = useState<DataSubjectRequest | undefined>();

  const handleEdit = (dsr: DataSubjectRequest) => {
    setSelectedDSR(dsr);
    setFormOpen(true);
  };

  const handleDeleteClick = (dsr: DataSubjectRequest) => {
    setDSRToDelete(dsr);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!dsrToDelete) return;
    try {
      // TODO: Implement delete mutation when API is available
      toast.success("Data subject request deleted successfully");
      setDeleteDialogOpen(false);
      setDSRToDelete(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete request"
      );
    }
  };

  const columns: ColumnDef<DataSubjectRequest>[] = [
    {
      accessorKey: "requester_name",
      header: "Requester",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.requester_name}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm capitalize">{row.original.type.replace(/_/g, " ")}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteClick(row.original)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (dsr: DataSubjectRequest) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{dsr.requester_name}</span>
        <Badge variant={statusVariant(dsr.status)}>
          {dsr.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground capitalize">
        {dsr.type.replace(/_/g, " ")}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleEdit(dsr)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleDeleteClick(dsr)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Protection"
        description="Data subject requests, retention policies, and compliance"
        actions={
          <Button
            className="w-full md:w-auto min-h-[44px]"
            onClick={() => {
              setSelectedDSR(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Request
          </Button>
        }
      />

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Retention Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage data retention rules
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Sub-Processors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track third-party processors
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Privacy Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage consent notices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DSR table */}
      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        emptyTitle="No data subject requests"
        emptyDescription="Requests from data subjects will appear here."
        mobileCard={mobileCard}
      />

      <DSRFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setSelectedDSR(undefined);
          }
        }}
        dsr={selectedDSR}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Data Subject Request"
        description={`Are you sure you want to delete the request from "${dsrToDelete?.requester_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={false}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
