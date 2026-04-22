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

interface GeofenceDetails {
  reason?: string;
  distance_m?: number;
  radius_m?: number;
}

/**
 * Reason-specific copy for the `GEOFENCE_VIOLATION` error. Returns `null`
 * when the backend code is not a geofence violation.
 */
function describeGeofenceViolation(
  error: ApiError
): CheckinErrorInfo | null {
  if (error.code !== "GEOFENCE_VIOLATION") return null;
  const details = (error.details ?? {}) as GeofenceDetails;
  const reason = details.reason;
  const distance = typeof details.distance_m === "number" ? Math.round(details.distance_m) : null;
  const radius = typeof details.radius_m === "number" ? Math.round(details.radius_m) : null;

  switch (reason) {
    case "missing_visitor_location":
      return {
        title: "Location access required",
        message:
          "This site requires a location check before you can check in. Please enable location access in your browser and try again.",
        retryable: true,
        allowManualFallback: false,
      };
    case "outside_reference_point":
      return {
        title: "You're outside the check-in zone",
        message:
          distance && radius
            ? `You appear to be about ${distance}m from the reception area (the site allows up to ${radius}m). Please move closer and try again.`
            : "Please move closer to the reception area and try again.",
        retryable: true,
        allowManualFallback: false,
      };
    case "outside_approver_radius":
      return {
        title: "No approver nearby",
        message:
          "We couldn't find an on-site approver close enough to check you in. Please ask reception to retry on your behalf.",
        retryable: true,
        allowManualFallback: false,
      };
    case "no_active_approvers":
      return {
        title: "No approver on-site",
        message:
          "No approver is currently on-site to accept your check-in. Please wait a moment or ask reception for help.",
        retryable: true,
        allowManualFallback: false,
      };
    case "tenant_misconfigured":
      return {
        title: "Check-in is not ready",
        message:
          "This kiosk's location settings haven't been fully configured. Please ask the site administrator for help.",
        retryable: false,
        allowManualFallback: false,
      };
    default:
      return {
        title: "Check-in blocked",
        message:
          error.message ||
          "Your location doesn't match the site's check-in zone. Please move closer to the reception area and try again.",
        retryable: true,
        allowManualFallback: false,
      };
  }
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

  // Geofence violations arrive as 403 with a specific code; branch on the
  // code first so we don't collapse them into the generic 403 bucket.
  const geofence = describeGeofenceViolation(error);
  if (geofence) return geofence;

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
