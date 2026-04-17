"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  IdCard,
  Users,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { PageHeader } from "@/components/recipes/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import {
  useCheckinConfigs,
  useDeleteCheckinConfig,
} from "@/features/checkins/hooks";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { ApiError } from "@/types/api";
import type { CheckinConfig } from "@/types/checkin";

export default function CheckinConfigsPage() {
  const router = useRouter();
  const { tenantId } = useSession();
  const { hasCapability } = useCapabilities();
  const canEdit = hasCapability(CAPABILITIES.CHECKIN_CONFIG_EDIT);
  const canView = hasCapability(CAPABILITIES.CHECKIN_CONFIG_VIEW);

  const { data: configs = [], isLoading } = useCheckinConfigs(
    tenantId ?? undefined
  );
  const deleteMutation = useDeleteCheckinConfig();

  const [deleteTarget, setDeleteTarget] = useState<CheckinConfig | null>(null);

  if (!canView) {
    return (
      <PermissionDenied message="You don't have permission to view check-in configs." />
    );
  }

  async function handleDelete() {
    if (!deleteTarget || !tenantId) return;
    try {
      await deleteMutation.mutateAsync({
        configId: deleteTarget.id,
        tenantId,
      });
      toast.success(`Deleted "${deleteTarget.name}".`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Couldn't delete the config. Please try again."
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in configs"
        description="What visitors see on the kiosk at /register: required fields, ID upload, and returning-visitor lookup."
        actions={
          canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  className="min-h-[44px] w-full md:w-auto"
                >
                  <Link href="/app/settings/checkin-configs/new">
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    New config
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Create a new kiosk config for a different branch or department
              </TooltipContent>
            </Tooltip>
          )
        }
      />

      {isLoading ? (
        <PageSkeleton />
      ) : configs.length === 0 ? (
        <EmptyState
          title="No check-in configs yet"
          description="Create your first config to let visitors register at /register."
          actionLabel={canEdit ? "New config" : undefined}
          onAction={
            canEdit
              ? () => router.push("/app/settings/checkin-configs/new")
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {configs.map((config) => (
            <ConfigCard
              key={config.id}
              config={config}
              canEdit={canEdit}
              onEdit={() =>
                router.push(
                  `/app/settings/checkin-configs/${config.id}`
                )
              }
              onDelete={() => setDeleteTarget(config)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Delete this config?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed. Visitors won't be able to use it for new check-ins. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Config Card ─────────────────────────────────────────────────────

interface ConfigCardProps {
  config: CheckinConfig;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function ConfigCard({ config, canEdit, onEdit, onDelete }: ConfigCardProps) {
  const requiredCount = config.requiredFields.filter((f) => f.required).length;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base truncate">{config.name}</CardTitle>
          <CardDescription className="flex items-center gap-2 mt-1">
            {config.active ? (
              <Badge variant="outline" className="gap-1 bg-success text-success-foreground border-transparent">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3" aria-hidden="true" />
                Inactive
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {config.requiredFields.length}{" "}
              {config.requiredFields.length === 1 ? "field" : "fields"}
              {requiredCount > 0 && (
                <span> ({requiredCount} required)</span>
              )}
            </span>
          </CardDescription>
        </div>

        {canEdit && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    aria-label="Config actions"
                  >
                    <MoreHorizontal
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">
                Open actions for this config
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>

      <CardContent className="space-y-3 flex-1">
        <div className="flex flex-wrap gap-2 text-xs">
          {config.idUploadEnabled && (
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 bg-muted/30">
              <IdCard className="h-3 w-3" aria-hidden="true" />
              ID upload
            </span>
          )}
          {config.allowReturningVisitorLookup && (
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 bg-muted/30">
              <Users className="h-3 w-3" aria-hidden="true" />
              Returning lookup
            </span>
          )}
          {config.autoApproveVerified && (
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 bg-muted/30">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Auto-approve
            </span>
          )}
        </div>

        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={onEdit}
              >
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit config
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Change fields, toggles, or the config name
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
}
