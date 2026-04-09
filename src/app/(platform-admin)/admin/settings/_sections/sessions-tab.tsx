"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { SessionsTable } from "@/components/settings/sessions-table";
import { CopyableId } from "@/components/settings/copyable-id";
import { useSettingsManifest, useSettingsSection } from "@/features/settings/hooks";
import {
  useSessions,
  useRevokeSession,
  useRevokeAllSessions,
} from "@/features/account/hooks";
import { toast } from "sonner";

export function SessionsTab() {
  const { data: manifest } = useSettingsManifest();
  const deletionSection = useSettingsSection(manifest, "account_deletion");
  const profile = manifest?.profile;

  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between rounded-lg px-3 py-3 min-h-[52px]">
          <p className="text-sm font-medium">Log out of all devices</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[36px]"
                onClick={() => {
                  revokeAllSessions.mutate(undefined, {
                    onSuccess: (data) => toast.success(`${data.revokedCount} session(s) revoked`),
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to revoke sessions"),
                  });
                }}
                disabled={revokeAllSessions.isPending}
              >
                {revokeAllSessions.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Log out
              </Button>
            </TooltipTrigger>
            <TooltipContent>End every active session and sign out all devices at once</TooltipContent>
          </Tooltip>
        </div>
      </section>

      {deletionSection && (
        <section>
          <div className="flex items-center justify-between rounded-lg px-3 py-3 min-h-[52px]">
            <div className="flex-1 mr-4">
              {deletionSection.blockedReason && (
                <p className="text-sm text-muted-foreground">{deletionSection.blockedReason}</p>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[36px] text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  disabled={!deletionSection.allowed}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete account
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {deletionSection.allowed
                  ? "Permanently delete your account and all associated data"
                  : deletionSection.blockedReason ?? "Account deletion is not available"}
              </TooltipContent>
            </Tooltip>
          </div>
        </section>
      )}

      {profile?.id && (
        <section>
          <div className="space-y-1">
            <CopyableId label="Admin ID" value={profile.id} />
          </div>
        </section>
      )}

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Active sessions</h2>
        <p className="text-sm text-muted-foreground mb-4">Devices where you are currently signed in</p>
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SessionsTable
            sessions={sessions ?? []}
            onRevoke={(id) => {
              revokeSession.mutate(id, {
                onSuccess: () => toast.success("Session revoked"),
                onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to revoke session"),
              });
            }}
            revokingId={revokeSession.isPending ? (revokeSession.variables as string) : null}
          />
        )}
      </section>
    </div>
  );
}
