import { Badge } from "@/components/ui/badge";
import type { SupportCaseCategory } from "@/types/enums";

const LABELS: Record<SupportCaseCategory, string> = {
  billing: "Billing",
  technical: "Technical",
  account: "Account",
  feature_request: "Feature Request",
  data_privacy: "Data Privacy",
  other: "Other",
};

export function CaseCategoryBadge({ category }: { category: SupportCaseCategory }) {
  return <Badge variant="outline">{LABELS[category]}</Badge>;
}

export const CASE_CATEGORY_LABELS = LABELS;
