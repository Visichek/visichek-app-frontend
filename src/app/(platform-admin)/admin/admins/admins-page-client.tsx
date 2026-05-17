"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Loader2,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Users as UsersIcon,
} from "lucide-react";
import { useSession } from "@/hooks/use-session";
import {
  useAdmins,
  useInviteAdmin,
  useUpdateAdminAccessPreset,
  useBulkUpdateAdminAccessPreset,
} from "@/features/admins/hooks/use-admins";
import { PageHeader } from "@/components/recipes/page-header";
import {
  DataTable,
  type DataTableBulkAction,
} from "@/components/recipes/data-table";
import { DetailSheet } from "@/components/recipes/detail-sheet";
import {
  RecordDetailList,
  type RecordDetailRow,
} from "@/components/recipes/record-detail-list";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { formatDateTime } from "@/lib/utils/format-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADMIN_ACCESS_PRESETS,
  ADMIN_PRESET_LABEL,
  ADMIN_PRESET_DESCRIPTION,
} from "@/lib/permissions/admin-access";
import type { AdminAccessPreset } from "@/types/auth";
import type { Admin } from "@/types/user";

// ── Helpers ───────────────────────────────────────────────────────────

function resolvePreset(admin: Admin): AdminAccessPreset {
  return admin.accessPreset ?? "all_controls";
}

function presetVariant(preset: AdminAccessPreset) {
  if (preset === "all_controls") return "success" as const;
  if (preset === "billing_only") return "warning" as const;
  return "secondary" as const;
}

// ── Invite modal ──────────────────────────────────────────────────────

interface InviteAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InviteAdminModal({ open, onOpenChange }: InviteAdminModalProps) {
  const inviteAdmin = useInviteAdmin();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [preset, setPreset] =
    React.useState<AdminAccessPreset>("all_controls");

  React.useEffect(() => {
    if (!open) {
      setFullName("");
      setEmail("");
      setPassword("");
      setPreset("all_controls");
    }
  }, [open]);

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    !inviteAdmin.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const result = await inviteAdmin.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        accessPreset: preset,
      });
      toast.success(
        `Invite sent to ${result.email}. They'll receive a welcome email with their temp password.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to invite admin",
      );
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Invite platform admin"
      description="They'll receive a welcome email with a temporary password and a 6-digit code on first login. 2FA is mandatory for every invited admin."
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-1.5">
          <Label htmlFor="admin-full-name">Full name</Label>
          <Input
            id="admin-full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ada Lovelace"
            autoComplete="name"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@visichek.com"
            autoComplete="off"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin-password">Temporary password</Label>
          <Input
            id="admin-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="off"
            minLength={8}
            required
          />
          <p className="text-xs text-muted-foreground">
            Share this with the invitee out of band. They&apos;ll be asked
            to change it from Settings → Account after first login.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin-preset">Access preset</Label>
          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as AdminAccessPreset)}
          >
            <SelectTrigger id="admin-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_ACCESS_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {ADMIN_PRESET_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {ADMIN_PRESET_DESCRIPTION[preset]}
          </p>
        </div>

        <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={inviteAdmin.isPending}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="min-h-[44px]"
              >
                {inviteAdmin.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending invite...
                  </>
                ) : (
                  "Send invite"
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Create the admin row, email a welcome message, and require 2FA on first login
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </ResponsiveModal>
  );
}

// ── Change-preset modal (single or bulk) ──────────────────────────────

interface ChangePresetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single admin row, or null when in bulk mode. */
  target: Admin | null;
  /** Selected admin ids in bulk mode; ignored when `target` is set. */
  bulkIds: string[];
  onSuccess: () => void;
}

function ChangePresetModal({
  open,
  onOpenChange,
  target,
  bulkIds,
  onSuccess,
}: ChangePresetModalProps) {
  const initial = target ? resolvePreset(target) : "all_controls";
  const [preset, setPreset] = React.useState<AdminAccessPreset>(initial);
  const single = useUpdateAdminAccessPreset(target?.id ?? "");
  const bulk = useBulkUpdateAdminAccessPreset();

  React.useEffect(() => {
    if (open) {
      setPreset(target ? resolvePreset(target) : "all_controls");
    }
  }, [open, target]);

  const isBulk = !target && bulkIds.length > 0;
  const isPending = single.isPending || bulk.isPending;

  async function handleSubmit() {
    if (isBulk) {
      try {
        const result = await bulk.mutateAsync({
          ids: bulkIds,
          accessPreset: preset,
        });
        if (result.failed.length === 0) {
          toast.success(
            `${result.succeeded.length} admin${result.succeeded.length === 1 ? "" : "s"} re-scoped to ${ADMIN_PRESET_LABEL[preset]}.`,
          );
        } else if (result.succeeded.length === 0) {
          toast.error(
            `All ${result.failed.length} updates failed. ${result.failed[0].error}`,
          );
        } else {
          toast.error(
            `${result.succeeded.length} of ${bulkIds.length} succeeded; ${result.failed.length} failed. Check the table and retry.`,
          );
        }
        onSuccess();
        onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Bulk update failed",
        );
      }
      return;
    }

    if (!target) return;
    try {
      await single.mutateAsync({ accessPreset: preset });
      toast.success(
        `${target.fullName} is now on the ${ADMIN_PRESET_LABEL[preset]} preset.`,
      );
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change preset",
      );
    }
  }

  const title = isBulk
    ? `Change access preset for ${bulkIds.length} admin${bulkIds.length === 1 ? "" : "s"}`
    : target
      ? `Change access preset for ${target.fullName}`
      : "";

  const description = isBulk
    ? "The new preset takes effect on each admin's next request (within 5 minutes due to the gate cache)."
    : "Picks which sections of the admin console this user can reach. The new preset takes effect on their next request.";

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <div className="space-y-4 mt-4">
        <div className="space-y-1.5">
          <Label htmlFor="change-preset-select">Access preset</Label>
          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as AdminAccessPreset)}
          >
            <SelectTrigger id="change-preset-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_ACCESS_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {ADMIN_PRESET_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {ADMIN_PRESET_DESCRIPTION[preset]}
          </p>
        </div>

        <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="min-h-[44px]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save preset"
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isBulk
                ? "Issue a PATCH for each selected admin and aggregate the results"
                : "Persist the new preset on this admin's row"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </ResponsiveModal>
  );
}

// ── Row action menu ───────────────────────────────────────────────────

interface AdminRowActionsProps {
  admin: Admin;
  onEditPreset: (admin: Admin) => void;
}

function AdminRowActions({ admin, onEditPreset }: AdminRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0"
          aria-label={`Open menu for ${admin.fullName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEditPreset(admin)}>
          <KeyRound className="mr-2 h-4 w-4" />
          Change access preset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Page client ───────────────────────────────────────────────────────

export function AdminsPageClient() {
  const { adminProfile } = useSession();
  const currentAdminId = adminProfile?.id ?? null;
  const { data: admins, isLoading, isError, refetch } = useAdmins();

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [presetTarget, setPresetTarget] = React.useState<Admin | null>(null);
  const [bulkPresetIds, setBulkPresetIds] = React.useState<string[]>([]);
  const [detailTarget, setDetailTarget] = React.useState<Admin | null>(null);

  const rows = React.useMemo(() => admins ?? [], [admins]);

  const handleEditPreset = (admin: Admin) => {
    setBulkPresetIds([]);
    setPresetTarget(admin);
  };

  const bulkActions: DataTableBulkAction<Admin>[] = [
    {
      label: "Change preset",
      description:
        "Re-scope every selected admin to a single chosen preset. The primary admin is skipped if included.",
      icon: <KeyRound className="h-4 w-4" />,
      onClick: (ids) => {
        // Drop the current admin from the selection — re-scoping yourself
        // mid-session would log you out of half the console.
        const safeIds = currentAdminId
          ? ids.filter((id) => id !== currentAdminId)
          : ids;
        if (safeIds.length === 0) {
          toast.info(
            "Nothing to update — your own row was the only selection.",
          );
          return;
        }
        if (safeIds.length < ids.length) {
          toast.info(
            "Skipped your own row — change your preset from a different admin's session.",
          );
        }
        setPresetTarget(null);
        setBulkPresetIds(safeIds);
      },
    },
  ];

  const columns: ColumnDef<Admin>[] = [
    {
      accessorKey: "fullName",
      header: "Name",
      cell: ({ row }) => {
        const admin = row.original;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{admin.fullName}</span>
            {currentAdminId && admin.id === currentAdminId && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                You
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.email}
        </span>
      ),
    },
    {
      accessorKey: "accessPreset",
      header: "Access preset",
      cell: ({ row }) => {
        const preset = resolvePreset(row.original);
        return (
          <Badge variant={presetVariant(preset)}>
            {ADMIN_PRESET_LABEL[preset]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "mfaEnabled",
      header: "2FA",
      cell: ({ row }) => {
        const mfaOn = row.original.mfaEnabled !== false;
        return mfaOn ? (
          <div className="flex items-center gap-1 text-sm text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
            On
          </div>
        ) : (
          <div className="flex items-center gap-1 text-sm text-amber-600">
            <ShieldAlert className="h-4 w-4" />
            Off
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Invited",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.createdAt
            ? formatDateTime(row.original.createdAt)
            : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <AdminRowActions
          admin={row.original}
          onEditPreset={handleEditPreset}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform admins"
        description="Invite new platform admins, re-scope their access preset, and review 2FA posture."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setInviteOpen(true)}
                className="w-full md:w-auto min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Invite admin
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the invite form to add a new platform admin with a chosen access preset
            </TooltipContent>
          </Tooltip>
        }
      />

      {isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load admins.{" "}
            <button
              onClick={() => refetch()}
              className="underline hover:opacity-70"
            >
              Try again
            </button>
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="email"
          searchPlaceholder="Search by email..."
          isLoading={isLoading}
          selectable
          getRowId={(admin) => admin.id}
          itemNoun="admin"
          bulkActions={bulkActions}
          onRowClick={(admin) => setDetailTarget(admin)}
          rowClickAriaLabel={(admin) =>
            `View details for admin ${admin.fullName}`
          }
          mobileCard={(admin) => {
            const preset = resolvePreset(admin);
            const mfaOn = admin.mfaEnabled !== false;
            return (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {admin.fullName}
                      {currentAdminId && admin.id === currentAdminId && (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {admin.email}
                    </p>
                  </div>
                  <Badge variant={presetVariant(preset)}>
                    {ADMIN_PRESET_LABEL[preset]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div
                    className={
                      mfaOn ? "text-emerald-600" : "text-amber-600"
                    }
                  >
                    {mfaOn ? "2FA on" : "2FA off"}
                  </div>
                  <AdminRowActions
                    admin={admin}
                    onEditPreset={handleEditPreset}
                  />
                </div>
              </div>
            );
          }}
        />
      )}

      <DetailSheet
        open={!!detailTarget}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
        title={detailTarget?.fullName ?? ""}
        description={detailTarget?.email}
      >
        {detailTarget && (
          <RecordDetailList
            rows={(
              [
                {
                  label: "Access preset",
                  value: (
                    <Badge variant={presetVariant(resolvePreset(detailTarget))}>
                      {ADMIN_PRESET_LABEL[resolvePreset(detailTarget)]}
                    </Badge>
                  ),
                },
                {
                  label: "Preset details",
                  value: ADMIN_PRESET_DESCRIPTION[resolvePreset(detailTarget)],
                  full: true,
                },
                {
                  label: "2FA",
                  value:
                    detailTarget.mfaEnabled !== false ? "Enabled" : "Disabled",
                },
                {
                  label: "Permission slice",
                  value: detailTarget.permissionList?.length
                    ? `${detailTarget.permissionList.length} routes`
                    : "—",
                },
                {
                  label: "Invited",
                  value: detailTarget.createdAt
                    ? formatDateTime(detailTarget.createdAt)
                    : null,
                },
                {
                  label: "Last updated",
                  value: detailTarget.updatedAt
                    ? formatDateTime(detailTarget.updatedAt)
                    : null,
                },
                {
                  label: "Admin ID",
                  value: (
                    <code className="text-xs font-mono">
                      {detailTarget.id}
                    </code>
                  ),
                },
              ] as RecordDetailRow[]
            ).filter(
              (r) =>
                r.value !== null &&
                r.value !== undefined &&
                r.value !== "",
            )}
          />
        )}
        {detailTarget && (
          <div className="mt-6 flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailTarget(null);
                    handleEditPreset(detailTarget);
                  }}
                  className="min-h-[44px]"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change access preset
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Open the preset picker to re-scope this admin
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </DetailSheet>

      <InviteAdminModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      <ChangePresetModal
        open={presetTarget !== null || bulkPresetIds.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setPresetTarget(null);
            setBulkPresetIds([]);
          }
        }}
        target={presetTarget}
        bulkIds={bulkPresetIds}
        onSuccess={() => {
          setPresetTarget(null);
          setBulkPresetIds([]);
        }}
      />

      {/* Empty-state hint when not loading and no admins (shouldn't really
          happen — the inviter is always at least one row — but render it
          to satisfy the "always handle empty" rule). */}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <UsersIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No platform admins yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the &quot;Invite admin&quot; button above to add your first
            teammate.
          </p>
        </div>
      )}
    </div>
  );
}
