// Public (kiosk) hooks — no auth required
export {
  useActiveCheckinConfigForTenant,
  usePublicCheckinConfig,
  useVisitorLookup,
  useSubmitCheckin,
} from "./use-public-checkin";

// Receptionist hooks — tenant-authenticated
export {
  useTenantCheckins,
  useCheckinDetail,
  useConfirmCheckin,
} from "./use-checkins";

// Admin config management hooks
export {
  useCheckinConfigs,
  useCheckinConfig,
  useCreateCheckinConfig,
  useUpdateCheckinConfig,
  useDeleteCheckinConfig,
  type CheckinConfigCreateInput,
  type CheckinConfigUpdateInput,
} from "./use-checkin-configs";
