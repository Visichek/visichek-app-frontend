import type { SupportCasePriority } from "@/types/enums";

/**
 * Plain-language presentation for the support-case `priority` field.
 *
 * A tenant opening a case shouldn't have to self-assess an abstract
 * "Low/Medium/High/Critical" scale — they describe the situation in everyday
 * words and we map it to the backend enum (`low | medium | high | critical`)
 * behind the scenes. The backend contract is unchanged; this only governs how
 * the value is shown when it is being chosen. Mirrors the incident
 * `risk-levels.ts` treatment.
 */
export interface PriorityLevelOption {
  /** The exact value sent to / received from the backend. */
  value: SupportCasePriority;
  /** Plain-language headline shown instead of the abstract priority word. */
  headline: string;
  /** One-line relatable example that anchors the reporter's choice. */
  example: string;
}

/** Ordered least → most urgent; this order drives the dropdown. */
export const PRIORITY_LEVEL_OPTIONS: readonly PriorityLevelOption[] = [
  {
    value: "low",
    headline: "Just a quick question",
    example: "e.g. how do I update my company logo?",
  },
  {
    value: "medium",
    headline: "Something's not working right",
    example: "e.g. a report is showing the wrong numbers",
  },
  {
    value: "high",
    headline: "A feature we rely on is broken",
    example: "e.g. we can't check visitors in right now",
  },
  {
    value: "critical",
    headline: "Everything's down — we're stuck",
    example: "e.g. no one on our team can log in",
  },
] as const;

/** Lookup by backend value, for rendering the helper text of the current selection. */
export const PRIORITY_LEVEL_BY_VALUE: Record<
  SupportCasePriority,
  PriorityLevelOption
> = Object.fromEntries(
  PRIORITY_LEVEL_OPTIONS.map((option) => [option.value, option]),
) as Record<SupportCasePriority, PriorityLevelOption>;
