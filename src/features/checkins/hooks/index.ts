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
  useVerifyRegistrationToken,
} from "./use-public-checkin";

// Public check-in status long-poll (kiosk waiting → badge flow)
export { useCheckinStatus } from "./use-checkin-status";

// Receptionist hooks — tenant-authenticated
export {
  useTenantCheckins,
  useCheckinDetail,
  useConfirmCheckin,
  useForceApprovePendingCheckin,
  usePendingApprovals,
  useUpdateVisitorProfile,
  useManuallyVerifyCheckin,
  useBulkApproveCheckins,
  useBulkRejectCheckins,
  useBulkForceApprovePendingCheckins,
  type BulkApprovePerIdResult,
  type BulkApproveArgs,
  type BulkRejectArgs,
  type BulkForceApprovePendingArgs,
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
