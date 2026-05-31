import type { IncidentRiskLevel } from "@/types/incident";

/**
 * Plain-language presentation for the incident `riskLevel` field.
 *
 * Reporters shouldn't have to self-assess an abstract "Low/Medium/High/Critical"
 * scale — they describe the impact in plain words and we map it to the backend
 * enum (`low | medium | high | critical`) behind the scenes. The backend contract
 * is unchanged; this only governs how the value is shown when it is being chosen.
 */
export interface RiskLevelOption {
  /** The exact value sent to / received from the backend. */
  value: IncidentRiskLevel;
  /** Plain-language headline shown instead of the abstract severity word. */
  headline: string;
  /** One-line concrete example that anchors the reporter's choice. */
  example: string;
}

/** Ordered least → most severe; this order drives the dropdown. */
export const RISK_LEVEL_OPTIONS: readonly RiskLevelOption[] = [
  {
    value: "low",
    headline: "Affects one person",
    example: "e.g. a single badge printed with a typo",
  },
  {
    value: "medium",
    headline: "Affects some people",
    example: "e.g. a few visitors' details were shown to the wrong staff member",
  },
  {
    value: "high",
    headline: "Affects many people",
    example: "e.g. a whole department's visitor log was exposed",
  },
  {
    value: "critical",
    headline: "Affects everyone",
    example: "e.g. the full visitor database may have leaked",
  },
] as const;

/** Lookup by backend value, for rendering the helper text of the current selection. */
export const RISK_LEVEL_BY_VALUE: Record<IncidentRiskLevel, RiskLevelOption> =
  Object.fromEntries(
    RISK_LEVEL_OPTIONS.map((option) => [option.value, option]),
  ) as Record<IncidentRiskLevel, RiskLevelOption>;
