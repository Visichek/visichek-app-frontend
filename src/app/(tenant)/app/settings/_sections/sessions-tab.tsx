"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { SessionsTable } from "@/components/settings/sessions-table";
import { useSettingsManifest, useSettingsSection } from "@/features/settings/hooks";
import {
  useSessions,
  useRevokeSession,
  useRevokeAllSessions,
} from "@/features/account/hooks";
import { toast } from "sonner";

export function SessionsTab() {
  const { data: manifest } = useSettingsManifest();
  const sessionsSection = useSettingsSection(manifest, "sessions");

  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();

  return (
    <div className="space-y-6">
      {sessionsSection && (
        <>
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
        </>
      )}
    </div>
  );
}
