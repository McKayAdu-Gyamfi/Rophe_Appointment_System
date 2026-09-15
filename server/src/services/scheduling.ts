import type { Prisma } from "@prisma/client";
import { badRequest, conflict, notFound } from "../lib/httpError";
import { toDateKey, toTimeKey } from "../mappers/datetime";

// ---------------------------------------------------------------------------
// The booking rules, in one place.
//
// The booking form already enforces all of this in the browser. That is a
// convenience, not a control: anything reaching this API can skip it entirely,
// so every rule the form applies is re-applied here against the database.
//
// Kept out of the controller because these are the rules the clinic argued
// about — how long a first visit takes, whether a no-show counts as having
// been seen — and they should be readable without an Express handler wrapped
// round them.
// ---------------------------------------------------------------------------

/** A transaction client, so every check reads the same snapshot as the write. */
export type Tx = Prisma.TransactionClient;

/** "09:30" → 570. Times are "HH:mm" throughout; see mappers/datetime.ts. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export interface Window {
  startTime: string;
  endTime: string;
}

/**
 * The hours a doctor actually works on one specific date.
 *
 * An exception replaces the weekly pattern for that date rather than adding to
 * it: "I'm away on the 27th" and "Tuesdays 09:00–13:00" are statements about
 * the same day, and the more specific one has to win outright or the doctor
 * is still bookable on the day they said they were away.
 */
export async function windowsForDate(tx: Tx, doctorId: string, date: Date): Promise<Window[]> {
  const dayStart = new Date(`${toDateKey(date)}T00:00:00.000Z`);

  const exceptions = await tx.availabilityException.findMany({
    where: { doctorId, date: dayStart },
  });

  if (exceptions.length > 0) {
    // A closed exception ends the question, whatever else is on the date.
    if (exceptions.some((exception) => exception.isClosed)) return [];

    return exceptions
      .filter((exception) => exception.startTime && exception.endTime)
      .map((exception) => ({ startTime: exception.startTime!, endTime: exception.endTime! }));
  }

  return tx.doctorAvailability.findMany({
    where: { doctorId, dayOfWeek: dayStart.getUTCDay() },
    select: { startTime: true, endTime: true },
  });
}

/**
 * The visit has to start inside a window *and* finish before that window
 * closes. A 40-minute first visit cannot start 30 minutes before the doctor
 * leaves — the half of it that matters is the half that would not happen.
 */
export function assertInsideAvailability(
  windows: Window[],
  time: string,
  durationMinutes: number,
) {
  if (windows.length === 0) {
    throw conflict("The doctor isn't working that day.");
  }

  const start = toMinutes(time);
  const end = start + durationMinutes;

  const covering = windows.find(
    (window) => start >= toMinutes(window.startTime) && start < toMinutes(window.endTime),
  );
  if (!covering) {
    const offered = windows.map((w) => `${w.startTime}–${w.endTime}`).join(", ");
    throw conflict(`The doctor isn't available at that time. They work ${offered} that day.`);
  }

  if (end > toMinutes(covering.endTime)) {
    throw conflict(
      `A ${durationMinutes}-minute appointment starting at ${time} runs past the ${covering.endTime} finish.`,
    );
  }
}

/**
 * No two visits in the same chair.
 *
 * Compared as half-open intervals: an appointment ending at 09:30 and one
 * starting at 09:30 do not overlap, which is the whole basis of a slot grid.
 * Cancelled appointments are ignored — the slot is genuinely free again.
 */
export async function assertNoOverlap(
  tx: Tx,
  doctorId: string,
  startsAt: Date,
  durationMinutes: number,
  ignoreAppointmentId?: string,
) {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  // Widen the scan by the longest plausible visit so an appointment that
  // starts before this one but runs into it is still considered.
  const scanFrom = new Date(startsAt.getTime() - 8 * 60 * 60_000);

  const sameDay = await tx.appointment.findMany({
    where: {
      doctorId,
      status: { not: "CANCELLED" },
      startsAt: { gte: scanFrom, lt: endsAt },
      ...(ignoreAppointmentId && { id: { not: ignoreAppointmentId } }),
    },
    select: { id: true, startsAt: true, durationMinutes: true },
  });

  const clash = sameDay.find((existing) => {
    const existingEnd = new Date(existing.startsAt.getTime() + existing.durationMinutes * 60_000);
    return existing.startsAt < endsAt && existingEnd > startsAt;
  });

  if (clash) {
    throw conflict(
      `That slot is taken — there is already an appointment at ${toTimeKey(clash.startsAt)}.`,
    );
  }
}

/**
 * Has the clinic ever actually seen this patient?
 *
 * ATTENDED only. Someone who booked last month and did not turn up is still,
 * clinically, a stranger to the doctor, and still needs the longer first-visit
 * slot — which is exactly the case a `count of appointments` test gets wrong.
 */
export async function isFirstVisit(tx: Tx, patientId: string): Promise<boolean> {
  const attended = await tx.appointment.count({
    where: { patientId, status: "ATTENDED" },
  });
  return attended === 0;
}

export interface DurationInput {
  /** What the caller asked for, if anything. An explicit value is an override. */
  requested?: number;
  firstVisit: boolean;
  firstVisitMinutes: number;
  typeMinutes: number;
}

/**
 * How long to book.
 *
 * First visit wins over type: the type names the service, not whether the
 * clinic has met this person, so a brand-new patient booked for a dietician
 * review still needs the time to register them and take a history.
 *
 * An explicit duration in the request beats both — front desk overriding the
 * rule is a decision, and the API is not in a position to second-guess it.
 */
export function resolveDuration({
  requested,
  firstVisit,
  firstVisitMinutes,
  typeMinutes,
}: DurationInput): number {
  if (requested !== undefined) {
    if (requested <= 0 || requested > 8 * 60) {
      throw badRequest("That appointment length doesn't look right.");
    }
    return requested;
  }
  return firstVisit ? firstVisitMinutes : typeMinutes;
}

/** Appointment types are addressed by name — that is what the frontend sends. */
export async function requireTypeByName(tx: Tx, name: string) {
  const type = await tx.appointmentType.findUnique({ where: { name } });
  if (!type) throw notFound(`"${name}" is not one of the clinic's appointment types.`);
  if (!type.active) {
    throw conflict(`"${name}" is no longer offered. Pick a current appointment type.`);
  }
  return type;
}
