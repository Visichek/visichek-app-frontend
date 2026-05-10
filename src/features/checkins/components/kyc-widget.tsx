"use client";

/**
 * Wraps the Dojah React widget for use on the kiosk.
 *
 * `appID`, `publicKey`, `widget_id`, and `type` are hardcoded below —
 * they're public Dojah identifiers (safe to ship in the bundle) and the
 * backend wasn't reliably populating them on the widget config. Per-checkin
 * `metadata` (tenantId, checkinId, etc.) still comes from
 * `POST /v1/kyc/initiate` so the webhook can correlate.
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

const DOJAH_APP_ID = "69f0e700ece0dca6443aba71";
const DOJAH_PUBLIC_KEY = "test_pk_g8uhAUb41FTYPzvuRMXS4u3Ts";
const DOJAH_WIDGET_ID = "69f241470f649c817fbc2db8";
const DOJAH_WIDGET_TYPE = "custom";

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
  // Mirrors the index signature on the SDK's `userData` prop so we can
  // pass extra fields (e.g. `residence_country`) without a type cast.
  [key: string]: unknown;
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
      appID={DOJAH_APP_ID}
      publicKey={DOJAH_PUBLIC_KEY}
      type={DOJAH_WIDGET_TYPE}
      config={{ widget_id: DOJAH_WIDGET_ID }}
      metadata={widgetConfig.metadata as Record<string, unknown>}
      userData={userData}
      response={onEvent}
    />
  );
}
