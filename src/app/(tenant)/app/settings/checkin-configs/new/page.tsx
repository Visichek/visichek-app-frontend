"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { CheckinConfigForm } from "@/features/checkins";
import { useCreateCheckinConfig } from "@/features/checkins/hooks";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { ApiError } from "@/types/api";

export default function NewCheckinConfigPage() {
  const router = useRouter();
  const { tenantId } = useSession();
  const { hasCapability } = useCapabilities();
  const canEdit = hasCapability(CAPABILITIES.CHECKIN_CONFIG_EDIT);

  const createMutation = useCreateCheckinConfig(tenantId ?? undefined);

  if (!canEdit) {
    return (
      <PermissionDenied message="You don't have permission to create check-in configs." />
    );
  }

  if (!tenantId) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading tenant…
      </div>
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
        title="New check-in config"
        description="Set up what visitors see when they open /register on your kiosk or their phone."
      />

      <CheckinConfigForm
        tenantId={tenantId}
        submitLabel="Create config"
        isSubmitting={createMutation.isPending}
        onCancel={() => router.push("/app/settings/checkin-configs")}
        onSubmit={async (values) => {
          try {
            const created = await createMutation.mutateAsync(
              // values is a full CheckinConfigCreateInput on create
              values as Parameters<
                typeof createMutation.mutateAsync
              >[0]
            );
            toast.success(`Created "${created.name}".`);
            router.push("/app/settings/checkin-configs");
          } catch (err) {
            toast.error(
              err instanceof ApiError
                ? err.message
                : "Couldn't create the config. Please try again."
            );
            // Re-throw so the form's local error state can catch it.
            throw err;
          }
        }}
      />
    </div>
  );
}
