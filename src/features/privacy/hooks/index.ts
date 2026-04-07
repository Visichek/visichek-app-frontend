export {
  useRetentionPolicies,
  useCreateRetentionPolicy,
  useUpdateRetentionPolicy,
  type CreateRetentionPolicyRequest,
  type UpdateRetentionPolicyRequest,
} from "./use-retention-policies";

export {
  useSubProcessors,
  useCreateSubProcessor,
  useUpdateSubProcessor,
  useDeleteSubProcessor,
  type CreateSubProcessorRequest,
  type UpdateSubProcessorRequest,
} from "./use-sub-processors";

export {
  usePrivacyNotices,
  useActivePrivacyNotice,
  useCreatePrivacyNotice,
  useUpdatePrivacyNotice,
  type CreatePrivacyNoticeRequest,
  type UpdatePrivacyNoticeRequest,
} from "./use-privacy-notices";

export {
  useComplianceRegister,
  useCreateRegisterEntry,
  useDeletionLogs,
  useConsentLog,
  useComplianceExport,
} from "./use-compliance";
