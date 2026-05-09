// Public (kiosk) hooks — no auth required
export {
  useActiveCheckinConfigForTenant,
  usePublicCheckinConfig,
  useVisitorLookup,
  useVisitorStatus,
  useSubmitCheckin,
  useSubmitCheckinByVisitorId,
  useCheckinEnums,
  useCheckinEnumsForTenant,
  useKycInitiate,
  useKycSkip,
  useKycStatus,
} from "./use-public-checkin";

// Receptionist hooks — tenant-authenticated
export {
  useTenantCheckins,
  useCheckinDetail,
  useConfirmCheckin,
  usePendingApprovals,
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
