// ---------------------------------------------------------------------------
// Instants in, date + time out.
//
// The schema stores a UTC instant (`startsAt`) plus a duration; the frontend
// reads a "YYYY-MM-DD" day and an "HH:mm" clock time. Splitting and rejoining
// them is the API's job — see decision 4 in schema.prisma.
//
// Ghana is UTC+0 with no DST, so the UTC parts *are* the local parts and these
// helpers stay this simple. The day that stops being true, this is the one
// file that has to learn about a timezone.
// ---------------------------------------------------------------------------

/** "2026-03-09" — the calendar day of an instant. */
export function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** "09:30" — the 24-hour clock time of an instant. */
export function toTimeKey(value: Date): string {
  return value.toISOString().slice(11, 16);
}

/** Rejoin the frontend's pair back into the instant the database stores. */
export function toInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}
