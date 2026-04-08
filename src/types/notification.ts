// ── Notification Types ────────────────────────────────────────────────

export type NotificationType = "info" | "warning" | "error" | "success";

export interface NotificationOut {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  link?: string | null;
  userId: string;
  userType: string;
  tenantId?: string;
  dateCreated: number;
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
  >
>;
