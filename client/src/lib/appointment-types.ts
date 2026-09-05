import type { Appointment, ScheduleConfig } from "./types";

/**
 * Offered in the duration dropdown. 40 is here because the clinic's first-visit
 * rule needs it and the old list (15/30/45/60) could not express it.
 */
export const DURATION_OPTIONS = [15, 20, 30, 40, 45, 60];

export interface DurationInput {
  appointmentType: string;
  /** True when the clinic has no completed visit on record for this patient. */
  isFirstVisit: boolean;
}

/**
 * How long to book, before any manual override.
 *
 * First visit wins over type. Since the type names the service rather than the
 * stage, a brand-new patient is booked as "Dietician review" like anyone else
 * — but it is still their first visit, and still needs the firstVisitMinutes to
 * register them, take a history and examine them.
 */
export function defaultDurationFor({ appointmentType, isFirstVisit }: DurationInput, config: ScheduleConfig): number {
  if (isFirstVisit) return config.clinicSettings.firstVisitMinutes;
  const match = config.appointmentTypes.find((t) => t.name === appointmentType);
  return match?.durationMinutes ?? 30;
}

/** One line telling staff where the pre-filled duration came from. */
export function durationRationale({ appointmentType, isFirstVisit }: DurationInput, config: ScheduleConfig): string {
  if (isFirstVisit) {
    return `First visit — the clinic allows ${config.clinicSettings.firstVisitMinutes} minutes for a new patient.`;
  }
  const match = config.appointmentTypes.find((t) => t.name === appointmentType);
  const minutes = match?.durationMinutes ?? 30;
  return `Return visit — ${appointmentType.toLowerCase()} appointments run ${minutes} minutes.`;
}

/**
 * Whether a duration matches what the rule would have chosen. Used to tell an
 * intentional override apart from a stale value, so the form can re-derive the
 * duration when the patient or type changes but leave a hand-set one alone.
 */
export function isRuleDuration(minutes: number, input: DurationInput, config: ScheduleConfig): boolean {
  return minutes === defaultDurationFor(input, config);
}

// --- Slot arithmetic -------------------------------------------------------

/** Reserved-but-unused minutes a duration leaves in the grid. */
export function slotSlack(durationMinutes: number, slotMinutes: number): number {
  const slots = Math.max(1, Math.ceil(durationMinutes / slotMinutes));
  return slots * slotMinutes - durationMinutes;
}

/** True once an appointment's own duration no longer matches the rule. */
export function isOverridden(appointment: Appointment, isFirstVisit: boolean, config: ScheduleConfig): boolean {
  return !isRuleDuration(appointment.durationMinutes, {
    appointmentType: appointment.appointmentType,
    isFirstVisit,
  }, config);
}
