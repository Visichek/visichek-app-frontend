"use client";

import { Plus, Eye, MoreHorizontal } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
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
import { formatDate } from "@/lib/utils/format-date";
import { useTenantList } from "@/features/auth/hooks/use-admin-dashboard";
import type { AdminTenant } from "@/types/admin";

export default function TenantsPage() {
  const { data, isLoading } = useTenantList();
  const tenants = data || [];

  const getSubscriptionStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "trialing":
        return "info" as const;
      case "past_due":
        return "warning" as const;
      case "cancelled":
      case "suspended":
      case "expired":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const columns: ColumnDef<AdminTenant>[] = [
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => <span className="font-medium">{row.original.company_name}</span>,
    },
    {
      accessorKey: "contact_email",
      header: "Contact Email",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.contact_email || "—"}
        </span>
      ),
    },
    {
      accessorKey: "plan_name",
      header: "Plan",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.plan_name || "—"}</span>
      ),
    },
    {
      id: "subscription_status",
      header: "Subscription Status",
      cell: ({ row }) => (
        <Badge variant={getSubscriptionStatusVariant(row.original.subscription_status)}>
          {row.original.subscription_status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.created_at)}
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
            <DropdownMenuItem disabled>
              <Eye className="mr-2 h-4 w-4" />
              View Details (Coming soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (tenant: AdminTenant) => (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="font-medium">{tenant.company_name}</div>
      <div className="text-sm text-muted-foreground">
        {formatDate(tenant.created_at)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {tenant.plan_name || "—"}
        </span>
        <Badge variant={getSubscriptionStatusVariant(tenant.subscription_status)}>
          {tenant.subscription_status.replace(/_/g, " ")}
        </Badge>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            <Eye className="mr-2 h-4 w-4" />
            View Details (Coming soon)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage tenant organizations"
        actions={
          <Button className="w-full md:w-auto min-h-[44px]" disabled>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Bootstrap Tenant (Coming soon)
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={tenants}
        isLoading={isLoading}
        pagination={true}
        pageSize={10}
        searchKey="company_name"
        searchPlaceholder="Search tenants..."
        emptyTitle="No tenants yet"
        emptyDescription="Bootstrap your first tenant to get started."
        mobileCard={mobileCard}
      />
    </div>
  );
}
