"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Label } from "@/components/ui/label";
import { useDenyVisitor } from "@/features/visitors/hooks/use-visitors";

const denyVisitorSchema = z.object({
  reason: z.string().min(1, "Denial reason is required"),
});

type DenyVisitorFormData = z.infer<typeof denyVisitorSchema>;

interface DenyVisitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  visitorName: string;
}

export function DenyVisitorModal({
  open,
  onOpenChange,
  sessionId,
  visitorName,
}: DenyVisitorModalProps) {
  const denyVisitorMutation = useDenyVisitor();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DenyVisitorFormData>({
    resolver: zodResolver(denyVisitorSchema),
  });

  const onSubmit = async (data: DenyVisitorFormData) => {
    try {
      await denyVisitorMutation.mutateAsync({
        sessionId,
        reason: data.reason,
      });

      toast.success("Visitor entry denied");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to deny visitor entry"
      );
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Deny Visitor Entry"
      description={`Deny entry for ${visitorName}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason">Denial Reason *</Label>
          <textarea
            id="reason"
            placeholder="Enter the reason for denying this visitor entry"
            className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("reason")}
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? "error-reason" : undefined}
          />
          {errors.reason && (
            <p
              id="error-reason"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.reason.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex w-full gap-2 pt-4 md:justify-end">
          <LoadingButton
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="w-full md:w-auto"
          >
            Cancel
          </LoadingButton>
          <LoadingButton
            type="submit"
            variant="destructive"
            isLoading={denyVisitorMutation.isPending}
            loadingText="Denying entry..."
            className="w-full md:w-auto"
          >
            Deny Entry
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
