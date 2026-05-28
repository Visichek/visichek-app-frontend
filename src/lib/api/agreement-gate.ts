/**
 * Bridge between the (non-React) Axios interceptor and the React tree for the
 * tenant-agreement acceptance gate.
 *
 * When any operational write returns `403 AGREEMENT_ACCEPTANCE_REQUIRED`, the
 * interceptor fires a DOM event; the `AgreementGateBanner` listens for it and
 * refetches the pending-agreements query so the prompt appears immediately —
 * not just on the next login / window focus.
 */

export const AGREEMENT_GATE_EVENT = "visichek:agreement-acceptance-required";

export interface AgreementGateEventDetail {
  pending: string[];
}

/** Fire the gate event so the React tree can surface the acceptance prompt. */
export function emitAgreementGate(pending: string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AgreementGateEventDetail>(AGREEMENT_GATE_EVENT, {
      detail: { pending },
    }),
  );
}
