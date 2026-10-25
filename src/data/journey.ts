/**
 * Pure helpers around journey cards. These only sort, pick and replace
 * milestones — they never infer, score or interpret anything. The "next"
 * milestone is simply the earliest recorded upcoming date.
 */
import { MILESTONE_TEMPLATE, TEMPLATE_BY_ID } from './journeyTemplate';
import type { JourneyCard, Milestone, MilestoneStatus } from './model';

/** Milestone list for a newly registered mother: all upcoming, no dates yet. */
export function milestonesFromTemplate(): Milestone[] {
  return MILESTONE_TEMPLATE.map((item) => ({
    templateId: item.templateId,
    name: item.fallbackLabel,
    dueDate: null,
    status: 'upcoming' as MilestoneStatus,
    doneDate: null,
  }));
}

/** i18n key for a milestone label, when the template still knows this id. */
export function labelKeyFor(milestone: Milestone): string | null {
  return TEMPLATE_BY_ID[milestone.templateId]?.labelKey ?? null;
}

function byDate(a: string | null, b: string | null): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/** Earliest upcoming milestone that has a recorded due date, if any. */
export function nextMilestone(card: JourneyCard | null): Milestone | null {
  if (!card) return null;
  const dated = card.milestones.filter((m) => m.status === 'upcoming' && m.dueDate !== null);
  if (dated.length === 0) return null;
  return [...dated].sort((a, b) => byDate(a.dueDate, b.dueDate))[0] ?? null;
}

export function doneMilestones(card: JourneyCard): Milestone[] {
  return card.milestones
    .filter((m) => m.status === 'done')
    .sort((a, b) => byDate(a.doneDate ?? a.dueDate, b.doneDate ?? b.dueDate));
}

export function upcomingMilestones(card: JourneyCard): Milestone[] {
  return card.milestones
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => byDate(a.dueDate, b.dueDate));
}

/** Replace one milestone's status and recorded date. Returns a new array. */
export function withMilestoneStatus(
  milestones: Milestone[],
  templateId: string,
  status: MilestoneStatus,
  doneDate: string | null,
): Milestone[] {
  return milestones.map((m) =>
    m.templateId === templateId
      ? { ...m, status, doneDate: status === 'done' ? doneDate : null }
      : m,
  );
}

/** Replace one milestone's recorded due date. Returns a new array. */
export function withMilestoneDueDate(
  milestones: Milestone[],
  templateId: string,
  dueDate: string | null,
): Milestone[] {
  return milestones.map((m) => (m.templateId === templateId ? { ...m, dueDate } : m));
}
