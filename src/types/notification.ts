// ── Notification Types ────────────────────────────────────────────────

export type NotificationType = "info" | "warning" | "error" | "success";

/**
 * Light, denormalized info about the notification recipient. Backend now
 * embeds this so clients don't have to hop to /users/{id} just to show
 * "sent to Jane Doe" in an audit view. Always nullable — older rows may
 * predate the field.
 */
export interface NotificationUserSummary {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface NotificationTenantSummary {
  id: string;
  name?: string | null;
  slug?: string | null;
}

export interface NotificationOut {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  link?: string | null;
  userId: string;
  userType: string;
  // Platform-admin notifications have `tenantId: null`, so `null` must be
  // part of the type — a bare `?: string` lets `null` leak through as
  // `any` in consumers and hides shape bugs.
  tenantId?: string | null;
  dateCreated: number;
  lastUpdated?: number;
  userSummary?: NotificationUserSummary | null;
  tenantSummary?: NotificationTenantSummary | null;
}

/**
 * Some paginated list endpoints wrap their results in `{ data, meta }`
 * inside the standard envelope. The response interceptor unwraps the
 * outer envelope, so this is what the hook sees after unwrap.
 */
export interface NotificationListPage {
  data: NotificationOut[];
  meta?: {
    total?: number;
    skip?: number;
    limit?: number;
  };
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkAllReadResponse {
  markedCount: number;
}

export interface DeleteNotificationResponse {
  deleted: boolean;
}

// ── Notification Preferences ─────────────────────────────────────────

export interface NotificationPreferences {
  id: string;
  userId: string;
  userType: string;
  emailEnabled: boolean;
  emailOnIncident: boolean;
  emailOnVisitorCheckIn: boolean;
  emailOnAppointmentReminder: boolean;
  emailOnDsrReceived: boolean;
  emailOnSubscriptionAlert: boolean;
  emailOnNewUser: boolean;
  emailOnSupportCase: boolean;
  dateCreated: number;
  lastUpdated: number;
}

export type NotificationPreferencesUpdate = Partial<
  Pick<
    NotificationPreferences,
    | "emailEnabled"
    | "emailOnIncident"
    | "emailOnVisitorCheckIn"
    | "emailOnAppointmentReminder"
    | "emailOnDsrReceived"
    | "emailOnSubscriptionAlert"
    | "emailOnNewUser"
    | "emailOnSupportCase"
  >
>;
