import type { Appointment } from "./types";

// ---------------------------------------------------------------------------
// Appointment types and how long each one takes.
//
// The clinic's own numbers (WhatsApp feedback, Aug 2026):
//
//     "First time patients is 40mins · Follow-up is 15mins"
//
// So duration is not a free choice made per booking — it falls out of two
// facts the system already knows: what kind of visit it is, and whether this
// patient has ever been seen before. Front desk can still override, because a
// complicated case is a clinical judgement the software has no business
// making, but they should never have to *remember* the rule.
//
// The list itself moved here out of appointment-form.tsx so the booking form,
// the recall screen and any future report all read the same one.
//
// The types are the clinic's own, supplied August 2026, and replace the
// earlier guessed list. Two things about the new list shape the rule below:
//
//   * There is no "Consultation" or "New patient" entry. The type names the
//     *service*, not whether the clinic has met this person — a first-timer
//     seeing the dietician books "Dietician review" like everyone else. So the
//     40-minute rule cannot key off the type; it keys off the patient's own
//     history, which is what lib/visits.ts already answers.
//   * Four of the six are reviews, and a review is a return visit by
//     definition — nobody has a diabetes review before something diagnosed the
//     diabetes. That is why they sit on the 15-minute side.
// ---------------------------------------------------------------------------

export const APPOINTMENT_TYPES = [
  "Dietician review",
  "Diabetes review",
  "Urologist review",
  "General checkup",
  "Follow up",
  "Other specialist review",
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

/** A patient the clinic has never actually seen needs the long slot. */
export const FIRST_VISIT_MINUTES = 40;

/** A return visit against an existing record. */
export const FOLLOW_UP_MINUTES = 15;

/** A returning patient starting something new — the pre-existing default. */
export const STANDARD_MINUTES = 30;

/**
 * Offered in the duration dropdown. 40 is here because the clinic's first-visit
 * rule needs it and the old list (15/30/45/60) could not express it.
 */
export const DURATION_OPTIONS = [15, 20, 30, 40, 45, 60];

/**
 * Minutes a *returning* patient needs, by visit type.
 *
 * The clinic named only "follow up". Every "… review" inherits the same 15
 * minutes, on the reasoning above: a review is a return visit by definition.
 * A general checkup is the one type that is not a review, so it keeps the
 * 30 minutes the prototype has always used for it.
 *
 * Both extensions are flagged for sign-off in the PRD's open questions;
 * changing either is one line here.
 */
const RETURNING_MINUTES: Record<string, number> = {
  "Follow up": FOLLOW_UP_MINUTES,
  "Dietician review": FOLLOW_UP_MINUTES,
  "Diabetes review": FOLLOW_UP_MINUTES,
  "Urologist review": FOLLOW_UP_MINUTES,
  "Other specialist review": FOLLOW_UP_MINUTES,
  "General checkup": STANDARD_MINUTES,
};

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
 * — but it is still their first visit, and still needs the 40 minutes to
 * register them, take a history and examine them.
 */
export function defaultDurationFor({ appointmentType, isFirstVisit }: DurationInput): number {
  if (isFirstVisit) return FIRST_VISIT_MINUTES;
  return RETURNING_MINUTES[appointmentType] ?? STANDARD_MINUTES;
}

/** One line telling staff where the pre-filled duration came from. */
export function durationRationale({ appointmentType, isFirstVisit }: DurationInput): string {
  if (isFirstVisit) {
    return `First visit — the clinic allows ${FIRST_VISIT_MINUTES} minutes for a new patient.`;
  }
  const minutes = RETURNING_MINUTES[appointmentType] ?? STANDARD_MINUTES;
  return `Return visit — ${appointmentType.toLowerCase()} appointments run ${minutes} minutes.`;
}

/**
 * Whether a duration matches what the rule would have chosen. Used to tell an
 * intentional override apart from a stale value, so the form can re-derive the
 * duration when the patient or type changes but leave a hand-set one alone.
 */
export function isRuleDuration(minutes: number, input: DurationInput): boolean {
  return minutes === defaultDurationFor(input);
}

// --- Slot arithmetic -------------------------------------------------------
//
// The calendar grid is 30 minutes wide (lib/schedule.ts). Neither clinic
// duration divides into it cleanly: a 40-minute first visit spends two slots
// and gives 20 minutes back, a 15-minute follow-up spends one and gives 15
// back. That is how a paper diary behaves too, so the prototype keeps the grid
// and states the cost rather than quietly redesigning the doctor's
// availability screen around it. See the PRD's open questions.

/** Reserved-but-unused minutes a duration leaves in the 30-minute grid. */
export function slotSlack(durationMinutes: number, slotMinutes: number): number {
  const slots = Math.max(1, Math.ceil(durationMinutes / slotMinutes));
  return slots * slotMinutes - durationMinutes;
}

/** True once an appointment's own duration no longer matches the rule. */
export function isOverridden(appointment: Appointment, isFirstVisit: boolean): boolean {
  return !isRuleDuration(appointment.durationMinutes, {
    appointmentType: appointment.appointmentType,
    isFirstVisit,
  });
}
