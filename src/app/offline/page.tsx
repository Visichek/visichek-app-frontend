import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

import { OfflineReload } from "./offline-reload";

export const metadata: Metadata = {
  title: "Offline — VisiChek",
  description: "You appear to be offline.",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="text-muted-foreground">
          VisiChek needs a network connection for live visitor data. Reconnect and the
          page will reload automatically.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        If you just installed the app, try opening it again once you&apos;re back online.
      </p>
      <OfflineReload />
    </div>
  );
}
