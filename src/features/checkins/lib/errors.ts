import { ApiError } from "@/types/api";

/**
 * User-facing error copy for the kiosk submit flow.
 *
 * The backend uses HTTP status codes and `data.code` for machine-readable
 * errors. This helper turns them into actionable messages the visitor
 * (or receptionist) can act on without exposing backend jargon.
 */
export interface CheckinErrorInfo {
  title: string;
  message: string;
  /** Whether the UI should offer a one-click retry. */
  retryable: boolean;
  /** Whether falling back to manual entry (no ID file) is a valid next step. */
  allowManualFallback: boolean;
}

export function describeCheckinError(error: unknown): CheckinErrorInfo {
  if (!(error instanceof ApiError)) {
    return {
      title: "Something went wrong",
      message:
        "We couldn't reach the server. Check your connection and try again.",
      retryable: true,
      allowManualFallback: false,
    };
  }

  switch (error.status) {
    case 400:
      return {
        title: "Missing information",
        message:
          error.message ||
          "Some required fields are missing. Please complete the form and try again.",
        retryable: false,
        allowManualFallback: false,
      };
    case 404:
      return {
        title: "Kiosk unavailable",
        message:
          "This kiosk is not currently accepting check-ins. Please ask a receptionist for help.",
        retryable: false,
        allowManualFallback: false,
      };
    case 409:
      return {
        title: "Already pending",
        message:
          "You already have a check-in waiting for approval. Please see the receptionist.",
        retryable: false,
        allowManualFallback: false,
      };
    case 413:
      return {
        title: "File too large",
        message:
          "Your ID photo is too large. Try a smaller image (under 16 MB) or retake it.",
        retryable: false,
        allowManualFallback: true,
      };
    case 422:
      return {
        title: "We couldn't read your ID",
        message:
          error.message ||
          "The photo wasn't clear enough to verify. Try again in better lighting, or continue without an ID and a receptionist will verify you.",
        retryable: true,
        allowManualFallback: true,
      };
    case 502:
      return {
        title: "Verification service busy",
        message:
          "Our ID verification service is temporarily unavailable. Please try again in a moment, or continue without an ID.",
        retryable: true,
        allowManualFallback: true,
      };
    case 503:
      return {
        title: "ID verification unavailable",
        message:
          "ID verification isn't set up for this kiosk right now. Please continue without uploading an ID.",
        retryable: false,
        allowManualFallback: true,
      };
    default:
      return {
        title: "Something went wrong",
        message: error.message || "Please try again in a moment.",
        retryable: true,
        allowManualFallback: false,
      };
  }
}
