"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  UserCheck,
  ShieldCheck,
  ScanLine,
  Download,
} from "lucide-react";
import { DetailSheet } from "@/components/recipes/detail-sheet";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useVisitorSession,
  useUpdateDraftSession,
  useHostApprove,
} from "@/features/visitors/hooks/use-visitors";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { VerificationBadge, VisitStatusBadge } from "./verification-badges";
import { formatDateTime } from "@/lib/utils/format-date";
import type { VisitSession } from "@/types/visitor";

// ── Draft Edit Schema ────────────────────────────────────────────────

const draftSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  departmentId: z.string().optional(),
  hostId: z.string().optional(),
  purpose: z.string().optional(),
});

type DraftFormValues = z.infer<typeof draftSchema>;

// ── Props ────────────────────────────────────────────────────────────

interface SessionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: VisitSession;
  onConfirmCheckIn: (session: VisitSession) => void;
  onDenyEntry: (session: VisitSession) => void;
  onStartOcrVerification: (session: VisitSession) => void;
}

export function SessionDetailSheet({
  open,
  onOpenChange,
  session,
  onConfirmCheckIn,
  onDenyEntry,
  onStartOcrVerification,
}: SessionDetailSheetProps) {
  const { data: liveSession } = useVisitorSession(session.id);
  const departmentsQuery = useDepartments();
  const updateDraftMutation = useUpdateDraftSession();
  const hostApproveMutation = useHostApprove();

  const [isEditing, setIsEditing] = useState(false);

  // Use live session data if available, fallback to passed session
  const currentSession = liveSession || session;
  const isPending =
    currentSession.status === "registered" ||
    currentSession.status === "pending_verification";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<DraftFormValues>({
    resolver: zodResolver(draftSchema),
    defaultValues: {
      fullName: currentSession.visitorNameSnapshot || "",
      phone: "",
      company: "",
      departmentId: currentSession.departmentId || "",
      hostId: currentSession.hostId || "",
      purpose: currentSession.purpose || "",
    },
  });

  async function onSaveDraft(values: DraftFormValues) {
    try {
      await updateDraftMutation.mutateAsync({
        sessionId: currentSession.id,
        fullName: values.fullName || undefined,
        phone: values.phone || undefined,
        company: values.company || undefined,
        departmentId: values.departmentId || undefined,
        hostId: values.hostId || undefined,
        purpose: values.purpose || undefined,
      });
      toast.success("Session updated");
      setIsEditing(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update session"
      );
    }
  }

  async function handleHostApprove() {
    try {
      await hostApproveMutation.mutateAsync(currentSession.id);
      toast.success("Host approval recorded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record host approval"
      );
    }
  }

  async function handleBadgeDownload() {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/visitors/sessions/${currentSession.id}/badge`,
        {
          headers: {
            Authorization: `Bearer ${(await import("@/lib/auth/tokens")).getAccessToken()}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch badge");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `badge-${(currentSession.visitorNameSnapshot || "visitor").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Badge downloaded");
    } catch {
      toast.error("Failed to download badge");
    }
  }

  // ── Actions based on session state ────────────────────────────────
  const actions = isPending ? (
    <div className="flex w-full gap-2 flex-col md:flex-row">
      <Button
        variant="default"
        onClick={() => {
          onOpenChange(false);
          onConfirmCheckIn(currentSession);
        }}
        className="flex-1 min-h-[44px]"
      >
        <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
        Confirm Check-In
      </Button>
      <Button
        variant="destructive"
        onClick={() => {
          onOpenChange(false);
          onDenyEntry(currentSession);
        }}
        className="flex-1 min-h-[44px]"
      >
        Deny Entry
      </Button>
    </div>
  ) : currentSession.status === "checked_in" ? (
    <Button
      variant="outline"
      onClick={handleBadgeDownload}
      className="w-full min-h-[44px]"
    >
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      Download Badge
    </Button>
  ) : null;

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Session Details"
      description={
        currentSession.visitorNameSnapshot || "Visitor session"
      }
      actions={actions}
    >
      {/* Status and verification */}
      <div className="flex flex-wrap gap-2">
        <VisitStatusBadge status={currentSession.status} />
        {currentSession.checkInMethod && (
          <Badge variant="outline" className="text-xs">
            {currentSession.checkInMethod.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      {/* Session info */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Visitor</span>
          <span className="font-medium">
            {currentSession.visitorNameSnapshot || "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Department</span>
          <span className="font-medium">
            {currentSession.departmentId || "—"}
          </span>
        </div>
        {currentSession.hostId && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Host</span>
            <span className="font-medium">{currentSession.hostId}</span>
          </div>
        )}
        {currentSession.purpose && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Purpose</span>
            <span className="font-medium text-right max-w-[60%]">
              {currentSession.purpose}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Registered</span>
          <span className="font-medium">
            {formatDateTime(currentSession.checkedInAt)}
          </span>
        </div>
        {currentSession.checkedOutAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Checked Out</span>
            <span className="font-medium">
              {formatDateTime(currentSession.checkedOutAt)}
            </span>
          </div>
        )}
      </div>

      {/* Pending-only: verification actions */}
      {isPending && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Verification</h4>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onStartOcrVerification(currentSession);
                }}
                className="justify-start min-h-[44px]"
              >
                <ScanLine className="mr-2 h-4 w-4" aria-hidden="true" />
                Scan ID Document
              </Button>
              <LoadingButton
                variant="outline"
                size="sm"
                onClick={handleHostApprove}
                isLoading={hostApproveMutation.isPending}
                loadingText="Approving..."
                className="justify-start min-h-[44px]"
              >
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Host Approval
              </LoadingButton>
            </div>
          </div>
        </>
      )}

      {/* Pending-only: edit draft */}
      {isPending && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Edit Details</h4>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              )}
            </div>

            {isEditing && (
              <form
                onSubmit={handleSubmit(onSaveDraft)}
                className="space-y-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="draft_department" className="text-xs">
                    Department
                  </Label>
                  <Select
                    value={watch("departmentId") || ""}
                    onValueChange={(v) => setValue("departmentId", v)}
                  >
                    <SelectTrigger
                      id="draft_department"
                      className="text-base md:text-sm h-9"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentsQuery.data?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="draft_host" className="text-xs">
                    Host ID
                  </Label>
                  <Input
                    id="draft_host"
                    className="h-9 text-base md:text-sm"
                    {...register("hostId")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="draft_purpose" className="text-xs">
                    Purpose
                  </Label>
                  <Input
                    id="draft_purpose"
                    className="h-9 text-base md:text-sm"
                    {...register("purpose")}
                  />
                </div>

                <div className="flex gap-2">
                  <LoadingButton
                    type="submit"
                    size="sm"
                    isLoading={updateDraftMutation.isPending}
                    loadingText="Saving..."
                    className="min-h-[36px]"
                  >
                    Save
                  </LoadingButton>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      reset();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </DetailSheet>
  );
}
