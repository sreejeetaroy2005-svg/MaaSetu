/**
 * MaaSetu — fixed, editable milestone template and mother-view copy.
 *
 * ⚠️ PLACEHOLDER CONTENT — PENDING CLINICAL REVIEW ⚠️
 *
 * This file is the single place where the care-plan template and the
 * mother-facing messages live. Every label here is a clearly marked
 * placeholder. The clinical lead will supply:
 *   1. the final milestone names and their order,
 *   2. the scheduling rule for due dates (the app deliberately does not
 *      calculate, suggest or infer any date — a worker records it),
 *   3. the approved mother-facing messages.
 *
 * Until then the app must not invent clinical schedules, interpret a note,
 * score risk, or label any value normal/abnormal.
 */

export interface MilestoneTemplateItem {
  /** Stable id stored on each milestone in a journey card. */
  templateId: string;
  /** i18n key under `milestones.*` — all displayed wording comes from there. */
  labelKey: string;
  /** English placeholder snapshot stored with the record at creation. */
  fallbackLabel: string;
}

/** Fixed milestone list applied to a new journey card, in display order. */
export const MILESTONE_TEMPLATE: MilestoneTemplateItem[] = [
  {
    templateId: 'registration',
    labelKey: 'milestones.registration',
    fallbackLabel: '[PLACEHOLDER] Registration',
  },
  {
    templateId: 'antenatal_1',
    labelKey: 'milestones.antenatal1',
    fallbackLabel: '[PLACEHOLDER] Antenatal visit 1',
  },
  {
    templateId: 'antenatal_2',
    labelKey: 'milestones.antenatal2',
    fallbackLabel: '[PLACEHOLDER] Antenatal visit 2',
  },
  {
    templateId: 'antenatal_3',
    labelKey: 'milestones.antenatal3',
    fallbackLabel: '[PLACEHOLDER] Antenatal visit 3',
  },
  {
    templateId: 'delivery',
    labelKey: 'milestones.delivery',
    fallbackLabel: '[PLACEHOLDER] Delivery',
  },
  {
    templateId: 'postnatal_1',
    labelKey: 'milestones.postnatal1',
    fallbackLabel: '[PLACEHOLDER] Postnatal visit 1',
  },
  {
    templateId: 'postnatal_2',
    labelKey: 'milestones.postnatal2',
    fallbackLabel: '[PLACEHOLDER] Postnatal visit 2',
  },
];

export const TEMPLATE_BY_ID: Record<string, MilestoneTemplateItem> = Object.fromEntries(
  MILESTONE_TEMPLATE.map((item) => [item.templateId, item]),
);

/**
 * Copy shown on the mother's read-only screen. Still placeholders: these keys
 * are the only text the mother view may show beyond her own milestone names.
 */
export const MOTHER_MESSAGE_KEYS = {
  intro: 'messages.motherIntro',
  doneEmpty: 'messages.motherDoneEmpty',
  nextEmpty: 'messages.motherNextEmpty',
} as const;

/** Status of the copy above — surfaced in the UI as a placeholder badge. */
export const CONTENT_STATUS = 'placeholder-pending-clinical-review' as const;
