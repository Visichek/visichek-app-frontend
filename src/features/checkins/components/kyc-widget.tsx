"use client";

/**
 * Wraps the Dojah React widget for use on the kiosk.
 *
 * The widget config is provided whole by `POST /v1/kyc/initiate` —
 * credentials, widget_id, pages, and metadata all come from the backend.
 * The frontend never reads Dojah credentials from environment variables;
 * this component is a thin pass-through.
 *
 * The SDK touches `window` on import, so we lazy-load via `next/dynamic`
 * with `ssr: false` to keep the kiosk shell server-renderable and to
 * avoid pulling the SDK into the initial bundle.
 */

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type {
  DojahResponseType,
  DojahProps,
} from "dojah-kyc-sdk-react";
import type { KycWidgetConfig } from "@/types/kyc";

const Dojah = dynamic<DojahProps>(() => import("dojah-kyc-sdk-react"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-muted-foreground p-6"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading verification…
    </div>
  ),
});

export type KycWidgetEventType = DojahResponseType;

export interface KycWidgetUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  dob?: string;
}

export interface KycWidgetProps {
  /**
   * Payload from `POST /v1/kyc/initiate`. Contains all Dojah credentials
   * and the per-check-in metadata bundle the webhook needs to correlate.
   */
  widgetConfig: KycWidgetConfig;
  /** Optional pre-fill — handed straight to the widget's userData prop. */
  userData?: KycWidgetUserData;
  /**
   * Single callback for every Dojah event. Branch on `type`:
   *   - `loading` / `begin`: visitor moving through pages — show progress.
   *   - `success`: webhook will follow; transition to a polling/wait UI.
   *   - `error`: prevent-completion failure; offer retry.
   *   - `close`: visitor closed the widget; result is inconclusive — poll
   *     `/kyc/status` before deciding.
   */
  onEvent: (type: KycWidgetEventType, data: unknown) => void;
}

export function KycWidget({ widgetConfig, userData, onEvent }: KycWidgetProps) {
  return (
    <Dojah
      appID={widgetConfig.app_id}
      publicKey={widgetConfig.public_key}
      type={widgetConfig.type}
      config={widgetConfig.config}
      metadata={widgetConfig.metadata as Record<string, unknown>}
      userData={userData}
      response={onEvent}
    />
  );
}
