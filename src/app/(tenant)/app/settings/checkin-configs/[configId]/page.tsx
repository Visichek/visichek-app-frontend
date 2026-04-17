"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { ErrorState } from "@/components/feedback/error-state";
import { CheckinConfigForm } from "@/features/checkins";
import {
  useCheckinConfig,
  useUpdateCheckinConfig,
} from "@/features/checkins/hooks";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { ApiError } from "@/types/api";

export default function EditCheckinConfigPage() {
  const router = useRouter();
  const params = useParams<{ configId: string }>();
  const configId = params?.configId;
  const { tenantId } = useSession();
  const { hasCapability } = useCapabilities();
  const canView = hasCapability(CAPABILITIES.CHECKIN_CONFIG_VIEW);
  const canEdit = hasCapability(CAPABILITIES.CHECKIN_CONFIG_EDIT);

  const {
    data: config,
    isLoading,
    isError,
    refetch,
  } = useCheckinConfig(configId);

  const updateMutation = useUpdateCheckinConfig();

  if (!canView) {
    return (
      <PermissionDenied message="You don't have permission to view check-in configs." />
    );
  }

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (isError || !config) {
    return (
      <ErrorState
        title="Couldn't load this config"
        message="The config may have been deleted or you may not have access."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/app/settings/checkin-configs")}
              className="min-h-[44px]"
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Go back to the list of check-in configs
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={`Edit: ${config.name}`}
        description="Change what visitors see on the kiosk. Updates go live immediately."
      />

      <CheckinConfigForm
        tenantId={tenantId ?? config.tenantId}
        initial={config}
        submitLabel="Save changes"
        isSubmitting={updateMutation.isPending}
        onCancel={() => router.push("/app/settings/checkin-configs")}
        onSubmit={async (values) => {
          if (!canEdit) {
            throw new Error(
              "You don't have permission to edit check-in configs."
            );
          }
          try {
            await updateMutation.mutateAsync({
              configId: config.id,
              ...values,
            });
            toast.success("Config saved.");
            router.push("/app/settings/checkin-configs");
          } catch (err) {
            toast.error(
              err instanceof ApiError
                ? err.message
                : "Couldn't save the config. Please try again."
            );
            throw err;
          }
        }}
      />
    </div>
  );
}
