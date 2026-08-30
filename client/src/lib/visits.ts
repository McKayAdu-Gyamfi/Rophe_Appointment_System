import type { Appointment, Message, Patient } from "./types";
import { dateKey } from "./format";

// ---------------------------------------------------------------------------
// Visit history and patient recall.
//
// The clinic asked for a list of "patients not showing up for the past 6
// months". What "showing up" meant was ambiguous, and the doctor settled it
// (WhatsApp, Aug 2026):
//
//     "It covers all you have mentioned — whether they booked and never showed
//      up, whether they just never came again after they came once … the 6
//      months is basically covering when last they visited the clinic."
//
// So there is exactly one clock, and it is *last actual visit*. How a patient
// came to be silent — a no-show, or simply never rebooking — does not change
// whether they belong on the list. It only changes what the front desk says
// when they call, which is why `reason` exists alongside the single threshold.
//
// Three consequences worth stating, because each was tempting to get wrong:
//
//   1. A patient with no completed visit still needs a clock. Theirs runs from
//      the day they registered — otherwise someone who booked once, no-showed,
//      and vanished would never surface, which is precisely the case the
//      doctor named first.
//
//   2. A patient with a future appointment is not lapsed, however long it has
//      been. They are already coming back; ringing them to ask why they never
//      return is the fastest way to look like a clinic that does not read its
//      own diary.
//
//   3. A patient with no appointment at all is not a recall either. The clinic
//      confirmed that registration and booking always happen together — nobody
//      is put on the register without a visit and a booking in the same breath
//      — so a record with zero appointments is not a patient who went quiet,
//      it is an incomplete registration or a duplicate. It gets its own state
//      (`unbooked`) and stays off the sweep: texting someone six months after a
//      half-finished form is the system chasing its own bad data.
//
//   4. Neither is a patient who no-showed last Tuesday. They are the *missed
//      visit* worklist on the dashboard, which chases them within days. The
//      recall sweep is the long tail behind it, and a list that repeated last
//      week's no-shows would just be the follow-up list with worse timing. So
//      the clock that decides eligibility is time since *any* contact with the
//      diary, while the date on screen stays what the doctor asked for: when
//      they were last actually seen.
//
// This module is also where "is this a first visit?" lives, which the booking
// form needs for the 40-minute rule (see lib/appointment-types.ts). Same
// question, same answer, one implementation.
// ---------------------------------------------------------------------------

/** The clinic's threshold: silent this long and the patient needs chasing. */
export const RECALL_MONTHS = 6;

/** Warning band — surfaced before they cross, so the list never arrives cold. */
export const LAPSING_MONTHS = 5;

/** Don't re-chase someone contacted this recently. One sweep, not a barrage. */
export const RECALL_COOLDOWN_DAYS = 30;

/**
 * Why the clock reads what it reads. The threshold is the same for all three;
 * this is the sentence front desk needs before dialling.
 */
export type RecallReason =
  /** Has attended at least once, then stopped coming. */
  | "stopped-returning"
  /** Booked at least once, never actually attended. */
  | "never-attended"
  /**
   * On the register with no appointment at all. Per the clinic this cannot
   * happen legitimately, so it flags a record to fix, not a patient to chase.
   */
  | "never-booked";

export type RecallState =
  /** Something is already on the calendar — not a recall candidate. */
  | "returning"
  /**
   * No appointment on record at all. Not a recall — an incomplete registration
   * that someone should finish or delete. Never enters the sweep, however old.
   */
  | "unbooked"
  /** In contact with the clinic recently enough not to need chasing. */
  | "active"
  /** Between the warning band and the threshold. */
  | "lapsing"
  /** Past the threshold — this is the worklist. */
  | "lapsed";

export interface PatientVisitSummary {
  patientId: string;
  /** Most recent attended appointment on or before today. */
  lastVisit?: Appointment;
  /** Next booked/confirmed/rescheduled appointment from today onwards. */
  nextAppointment?: Appointment;
  /** Completed visits. */
  visitCount: number;
  missedCount: number;
  /** No completed visit on record — drives the 40-minute first-visit rule. */
  isFirstVisit: boolean;
  /**
   * What "last seen" shows: the last visit if there is one, else the day they
   * were registered.
   */
  anchorDate: string;
  /** Whole months from `anchorDate` to today — the number on screen. */
  monthsSinceAnchor: number;
  /**
   * Latest contact with the diary of any kind — an attended visit, a no-show,
   * a cancellation — falling back to registration. Always on or after
   * `anchorDate`.
   */
  lastActivityDate: string;
  /** Whole months of silence. This is what decides `state`. */
  monthsQuiet: number;
  reason: RecallReason;
  state: RecallState;
  /** When a recall message was last sent to this patient, if ever. */
  lastRecallAt?: string;
  /** A recall went out inside the cooldown — leave them alone for now. */
  recentlyContacted: boolean;
}

/** Statuses that mean a future appointment is really expected to happen. */
const LIVE_STATUSES = new Set(["booked", "confirmed", "rescheduled"]);

/** Whole months between two "YYYY-MM-DD" dates, floored, never negative. */
export function monthsBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Not a full month until the day-of-month has come round again.
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.floor((to - from) / 86_400_000);
}

export interface SummariseOptions {
  /** Overridable so the logic is testable and the seed data stays honest. */
  today?: Date;
}

/**
 * Build a summary for every patient in one pass over the appointments and the
 * message log. Screens call this once and read from the map, rather than
 * re-scanning per row.
 */
export function buildVisitSummaries(
  patients: Patient[],
  appointments: Appointment[],
  messages: Message[] = [],
  options: SummariseOptions = {},
): Map<string, PatientVisitSummary> {
  const today = options.today ?? new Date();
  const todayKey = dateKey(today);

  // patientId → the raw facts, gathered first so the classification below
  // reads as one decision rather than one per loop iteration.
  const facts = new Map<
    string,
    {
      lastVisit?: Appointment;
      nextAppointment?: Appointment;
      lastActivity?: string;
      visitCount: number;
      missedCount: number;
      hasAnyAppointment: boolean;
    }
  >();

  for (const patient of patients) {
    facts.set(patient.id, { visitCount: 0, missedCount: 0, hasAnyAppointment: false });
  }

  for (const appt of appointments) {
    const entry = facts.get(appt.patientId);
    // An appointment for a patient who is not in the list (deleted record,
    // partial fetch) has nothing to summarise onto.
    if (!entry) continue;

    entry.hasAnyAppointment = true;

    if (appt.status === "attended" && appt.date <= todayKey) {
      entry.visitCount += 1;
      if (!entry.lastVisit || appt.date > entry.lastVisit.date) entry.lastVisit = appt;
    }

    if (appt.status === "missed") entry.missedCount += 1;

    // Any past appointment counts as contact, whatever became of it.
    if (appt.date <= todayKey && (!entry.lastActivity || appt.date > entry.lastActivity)) {
      entry.lastActivity = appt.date;
    }

    if (appt.date >= todayKey && LIVE_STATUSES.has(appt.status)) {
      const better =
        !entry.nextAppointment ||
        appt.date < entry.nextAppointment.date ||
        (appt.date === entry.nextAppointment.date && appt.time < entry.nextAppointment.time);
      if (better) entry.nextAppointment = appt;
    }
  }

  // Last recall message per patient. The log is not guaranteed sorted, so take
  // the max rather than the first match.
  const lastRecall = new Map<string, string>();
  for (const message of messages) {
    if (message.type !== "recall") continue;
    const current = lastRecall.get(message.patientId);
    if (!current || message.sentAt > current) lastRecall.set(message.patientId, message.sentAt);
  }

  const summaries = new Map<string, PatientVisitSummary>();

  for (const patient of patients) {
    const entry = facts.get(patient.id)!;
    const isFirstVisit = entry.visitCount === 0;

    const anchorDate = entry.lastVisit?.date ?? patient.registeredDate;
    const monthsSinceAnchor = monthsBetween(anchorDate, todayKey);

    const lastActivityDate =
      entry.lastActivity && entry.lastActivity > anchorDate ? entry.lastActivity : anchorDate;
    const monthsQuiet = monthsBetween(lastActivityDate, todayKey);

    const reason: RecallReason = entry.lastVisit
      ? "stopped-returning"
      : entry.hasAnyAppointment
        ? "never-attended"
        : "never-booked";

    // Order matters. A record with no appointment has no event to measure
    // silence from — only a registration date, which says nothing about
    // whether the clinic ever had a relationship with this person. So it is
    // decided before the clock is consulted, not after.
    const state: RecallState = !entry.hasAnyAppointment
      ? "unbooked"
      : entry.nextAppointment
        ? "returning"
        : monthsQuiet >= RECALL_MONTHS
          ? "lapsed"
          : monthsQuiet >= LAPSING_MONTHS
            ? "lapsing"
            : "active";

    const lastRecallAt = lastRecall.get(patient.id);

    summaries.set(patient.id, {
      patientId: patient.id,
      lastVisit: entry.lastVisit,
      nextAppointment: entry.nextAppointment,
      visitCount: entry.visitCount,
      missedCount: entry.missedCount,
      isFirstVisit,
      anchorDate,
      monthsSinceAnchor,
      lastActivityDate,
      monthsQuiet,
      reason,
      state,
      lastRecallAt,
      recentlyContacted: lastRecallAt
        ? daysBetween(lastRecallAt, today.toISOString()) < RECALL_COOLDOWN_DAYS
        : false,
    });
  }

  return summaries;
}

/**
 * First-visit test for a single patient, for callers that only hold
 * appointments — the booking form asks this on every patient selection.
 *
 * "First visit" means no *completed* visit. A patient who booked last month
 * and no-showed is still, clinically, someone the doctor has never met, and
 * still needs the 40-minute slot.
 */
export function isFirstVisit(patientId: string, appointments: Appointment[]): boolean {
  const today = dateKey(new Date());
  return !appointments.some(
    (a) => a.patientId === patientId && a.status === "attended" && a.date <= today,
  );
}

// --- Presentation helpers --------------------------------------------------

/**
 * "Booked once, never attended" — the sentence front desk needs on a call.
 *
 * The recall framing only makes sense for a patient who has actually gone
 * quiet. "Came once, never returned" is a false accusation against someone who
 * was here three weeks ago, so a patient still in contact gets a plain
 * description of their history instead.
 */
export function reasonLabel(summary: PatientVisitSummary): string {
  if (summary.state === "returning") return "Visit already booked";
  if (summary.state === "unbooked") return "No appointment on record";

  if (summary.state === "active" && summary.visitCount > 0) {
    return summary.visitCount === 1 ? "1 visit on record" : `${summary.visitCount} visits on record`;
  }

  switch (summary.reason) {
    case "stopped-returning":
      return summary.visitCount === 1
        ? "Came once, never returned"
        : `Stopped returning after ${summary.visitCount} visits`;
    case "never-attended":
      return summary.missedCount > 0
        ? `Booked ${summary.missedCount === 1 ? "once" : `${summary.missedCount} times`}, never attended`
        : "Booked, never attended";
    case "never-booked":
      return "No appointment on record";
  }
}

/**
 * "7 months ago" / "Last month" / "This month".
 *
 * Takes months rather than a summary because it also labels the *silence*
 * clock on the recall screen. Use `lastSeenLabel` for the "last seen" column,
 * which has to say "Never" rather than measure from a registration date.
 */
export function elapsedLabel(months: number): string {
  if (months <= 0) return "This month";
  if (months === 1) return "Last month";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years === 1 ? "1 year" : `${years} years`;
  return rest === 0 ? `${yearPart} ago` : `${yearPart} ${rest}m ago`;
}

/** Whether this summary belongs on the recall worklist. */
export function needsRecall(summary: PatientVisitSummary): boolean {
  return summary.state === "lapsed" && !summary.recentlyContacted;
}

/**
 * A patient record with nothing booked against it. The clinic registers and
 * books in one go, so this is an unfinished registration or a duplicate —
 * something to correct on the record, never something to message about.
 */
export function isUnbooked(summary: PatientVisitSummary): boolean {
  return summary.state === "unbooked";
}

/**
 * What the "last seen" column says. A patient with no completed visit has not
 * been seen at all, however long ago they registered — printing "2 years ago"
 * against a registration date reads as a visit that never happened.
 */
export function lastSeenLabel(summary: PatientVisitSummary): string {
  return summary.lastVisit ? elapsedLabel(summary.monthsSinceAnchor) : "Never seen";
}
