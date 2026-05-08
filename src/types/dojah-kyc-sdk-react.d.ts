/**
 * Ambient type declarations for `dojah-kyc-sdk-react`. The npm package
 * does not ship types — this stub mirrors the documented prop surface so
 * the kiosk's `KycWidget` wrapper can import it safely.
 *
 * Reference: https://docs.dojah.io/sdks/react-library
 */
declare module "dojah-kyc-sdk-react" {
  import type { ComponentType } from "react";

  export type DojahWidgetType =
    | "custom"
    | "verification"
    | "identification"
    | "liveness";

  export type DojahResponseType =
    | "loading"
    | "begin"
    | "success"
    | "error"
    | "close";

  export interface DojahProps {
    appID: string;
    publicKey: string;
    type: DojahWidgetType | string;
    config: { widget_id: string; [key: string]: unknown };
    metadata?: Record<string, unknown>;
    userData?: {
      first_name?: string;
      last_name?: string;
      dob?: string;
      email?: string;
      residence_country?: string;
      [key: string]: unknown;
    };
    govData?: Record<string, unknown>;
    response?: (type: DojahResponseType, data: unknown) => void;
    onSuccess?: (data: unknown) => void;
    onError?: (data: unknown) => void;
    onClose?: () => void;
  }

  const Dojah: ComponentType<DojahProps>;
  export default Dojah;
}
