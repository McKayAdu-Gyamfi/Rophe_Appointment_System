import type { Appointment, DoctorAvailability, ScheduleConfig } from "./types";
import { dateKey } from "./format";

// ---------------------------------------------------------------------------
// Slot maths shared by the appointments calendar and the booking form.
//
// The clinic day is rendered as a fixed grid; the doctor's declared
// availability decides which of those slots are actually bookable. Slots
// outside availability still render (greyed) so staff can see the shape of the
// day rather than a truncated one.
// ---------------------------------------------------------------------------

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** The seven dates of the Sunday-start week containing `date`. */
export function weekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Every slot label in the clinic day, available or not. */
export function daySlotTimes(config: ScheduleConfig): string[] {
  const times: string[] = [];
  const { slotMinutes, dayStart, dayEnd } = config.clinicSettings;
  for (let m = toMinutes(dayStart); m < toMinutes(dayEnd); m += slotMinutes) {
    times.push(toTime(m));
  }
  return times;
}

/**
 * All open windows for a day. A day can hold several — the doctor might work
 * 08:00–10:00 and 14:00–17:00 with a gap between — so this returns a list, not
 * a single window.
 */
export function windowsForDate(
  date: Date,
  availability: DoctorAvailability[],
): DoctorAvailability[] {
  return availability
    .filter((a) => a.dayOfWeek === date.getDay() && a.isAvailable)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** The open window covering this slot, if any. */
export function windowContaining(
  date: Date,
  time: string,
  availability: DoctorAvailability[],
): DoctorAvailability | undefined {
  const slot = toMinutes(time);
  return windowsForDate(date, availability).find(
    (w) => slot >= toMinutes(w.startTime) && slot < toMinutes(w.endTime),
  );
}

/** Is this slot inside any of the doctor's declared windows for that day? */
export function isSlotAvailable(
  date: Date,
  time: string,
  availability: DoctorAvailability[],
): boolean {
  return windowContaining(date, time, availability) !== undefined;
}

export interface DaySlot {
  time: string;
  /** Inside the doctor's declared availability window. */
  available: boolean;
  /** Appointments starting in this slot. */
  appointments: Appointment[];
  /** An appointment from an earlier slot still runs through this one. */
  occupied: boolean;
}

/**
 * Build the slot grid for one day. Appointments longer than slotMinutes mark
 * the slots they spill into as occupied, so a 45-minute visit doesn't leave a
 * bookable-looking gap behind it.
 */
export function buildDaySlots(
  date: Date,
  appointments: Appointment[],
  availability: DoctorAvailability[],
  config: ScheduleConfig,
): DaySlot[] {
  const key = dateKey(date);
  const onThisDay = appointments.filter((a) => a.date === key);

  return daySlotTimes(config).map((time) => {
    const slotStart = toMinutes(time);

    const starting = onThisDay.filter((a) => toMinutes(a.time) === slotStart);
    const spillsInto = onThisDay.some((a) => {
      const start = toMinutes(a.time);
      return start < slotStart && start + a.durationMinutes > slotStart;
    });

    return {
      time,
      available: isSlotAvailable(date, time, availability),
      appointments: starting,
      occupied: spillsInto,
    };
  });
}

/** Slots a new appointment could actually be booked into. */
export function bookableSlots(
  date: Date,
  appointments: Appointment[],
  availability: DoctorAvailability[],
  config: ScheduleConfig,
): DaySlot[] {
  return buildDaySlots(date, appointments, availability, config).filter(
    (slot) => slot.available && slot.appointments.length === 0 && !slot.occupied,
  );
}

/** "08:00–12:00" (or "08:00–10:00, 14:00–17:00") for a day, null when closed. */
export function availabilityLabel(
  date: Date,
  availability: DoctorAvailability[],
): string | null {
  const windows = windowsForDate(date, availability);
  if (windows.length === 0) return null;
  return windows.map((w) => `${w.startTime}–${w.endTime}`).join(", ");
}

/**
 * Rebuild a day's windows from the set of open slot times, merging adjacent
 * slots into the fewest possible ranges. This is what the availability grid
 * writes back after each toggle.
 */
export function mergeSlotsIntoWindows(
  doctorId: string,
  dayOfWeek: number,
  openTimes: string[],
  config: ScheduleConfig,
): DoctorAvailability[] {
  const sorted = [...new Set(openTimes)].sort((a, b) => toMinutes(a) - toMinutes(b));
  const windows: DoctorAvailability[] = [];
  const { slotMinutes } = config.clinicSettings;

  for (const time of sorted) {
    const start = toMinutes(time);
    const previous = windows[windows.length - 1];

    if (previous && toMinutes(previous.endTime) === start) {
      previous.endTime = toTime(start + slotMinutes);
    } else {
      windows.push({
        doctorId,
        dayOfWeek,
        startTime: time,
        endTime: toTime(start + slotMinutes),
        isAvailable: true,
      });
    }
  }

  return windows;
}
