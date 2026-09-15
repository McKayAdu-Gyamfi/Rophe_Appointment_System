import type { AppointmentStatus } from "@prisma/client";
import { toDateKey } from "../mappers/datetime";
import { toWireAppointment, type AppointmentWithType } from "../mappers/recordMappers";

// ---------------------------------------------------------------------------
// Visit history and patient recall.
//
// Ported from client/src/lib/visits.ts, which is the specification — its
// comments record what the doctor actually settled, and the exclusions below
// are the part that was easy to get wrong:
//
//   1. A patient with a future appointment is not lapsed. They are already
//      coming back; ringing to ask why they never return reads as a clinic
//      that does not open its own diary.
//   2. A patient whose last contact of any kind was recent is not lapsed
//      either. Last Tuesday's no-show belongs to the follow-up worklist, which
//      chases within days — the recall sweep is the long tail behind it.
//   3. A record with no appointment at all is not a recall. The clinic books
//      at registration, so a patient with nothing booked is an unfinished
//      entry or a duplicate. It gets its own state and stays off the sweep:
//      texting someone six months after a half-finished form is the system
//      chasing its own bad data.
//
// Computed on read, never stored. A stored "lapsed" flag is a fact that was
// true once, and something then has to remember to clear it when the patient
// walks back in — which is exactly the thing nobody remembers.
// ---------------------------------------------------------------------------

/** Statuses that mean a future appointment is really expected to happen. */
const LIVE_STATUSES: AppointmentStatus[] = ["BOOKED", "CONFIRMED", "RESCHEDULED"];

export type RecallReason = "stopped-returning" | "never-attended" | "never-booked";
export type RecallState = "returning" | "unbooked" | "active" | "lapsing" | "lapsed";

/** Whole months between two "YYYY-MM-DD" dates, floored, never negative. */
export function monthsBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00.000Z`);
  const to = new Date(`${toISO}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  // Not a full month until the day-of-month has come round again.
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export interface RecallThresholds {
  /** Silent this long and the patient needs chasing. */
  recallMonths: number;
  /** Warning band, so the worklist never arrives cold. */
  lapsingMonths: number;
  /** Don't re-chase someone contacted this recently. */
  recallCooldownDays: number;
}

export interface SummaryInput {
  patientId: string;
  registeredAt: Date;
  appointments: AppointmentWithType[];
  /** When a recall message was last sent to this patient, if ever. */
  lastRecallAt?: Date;
  thresholds: RecallThresholds;
  now: Date;
}

export function buildVisitSummary({
  patientId,
  registeredAt,
  appointments,
  lastRecallAt,
  thresholds,
  now,
}: SummaryInput) {
  const todayKey = toDateKey(now);

  let lastVisit: AppointmentWithType | undefined;
  let nextAppointment: AppointmentWithType | undefined;
  let lastActivity: string | undefined;
  let visitCount = 0;
  let missedCount = 0;
  let hasAnyAppointment = false;

  for (const appointment of appointments) {
    hasAnyAppointment = true;
    const date = toDateKey(appointment.startsAt);

    if (appointment.status === "ATTENDED" && date <= todayKey) {
      visitCount += 1;
      if (!lastVisit || date > toDateKey(lastVisit.startsAt)) lastVisit = appointment;
    }

    if (appointment.status === "MISSED") missedCount += 1;

    // Any past appointment counts as contact, whatever became of it.
    if (date <= todayKey && (!lastActivity || date > lastActivity)) lastActivity = date;

    if (date >= todayKey && LIVE_STATUSES.includes(appointment.status)) {
      if (!nextAppointment || appointment.startsAt < nextAppointment.startsAt) {
        nextAppointment = appointment;
      }
    }
  }

  // A patient with no completed visit still needs a clock; theirs runs from
  // the day they registered. Otherwise someone who booked once, no-showed and
  // vanished would never surface — the case the doctor named first.
  const anchorDate = lastVisit ? toDateKey(lastVisit.startsAt) : toDateKey(registeredAt);
  const monthsSinceAnchor = monthsBetween(anchorDate, todayKey);

  const lastActivityDate = lastActivity && lastActivity > anchorDate ? lastActivity : anchorDate;
  const monthsQuiet = monthsBetween(lastActivityDate, todayKey);

  const reason: RecallReason = lastVisit
    ? "stopped-returning"
    : hasAnyAppointment
      ? "never-attended"
      : "never-booked";

  // Order matters. A record with no appointment has no event to measure
  // silence from, so it is decided before the clock is consulted, not after.
  const state: RecallState = !hasAnyAppointment
    ? "unbooked"
    : nextAppointment
      ? "returning"
      : monthsQuiet >= thresholds.recallMonths
        ? "lapsed"
        : monthsQuiet >= thresholds.lapsingMonths
          ? "lapsing"
          : "active";

  return {
    patientId,
    lastVisit: lastVisit ? toWireAppointment(lastVisit) : undefined,
    nextAppointment: nextAppointment ? toWireAppointment(nextAppointment) : undefined,
    visitCount,
    missedCount,
    isFirstVisit: visitCount === 0,
    anchorDate,
    monthsSinceAnchor,
    lastActivityDate,
    monthsQuiet,
    reason,
    state,
    lastRecallAt: lastRecallAt?.toISOString(),
    recentlyContacted: lastRecallAt
      ? daysBetween(lastRecallAt, now) < thresholds.recallCooldownDays
      : false,
  };
}
