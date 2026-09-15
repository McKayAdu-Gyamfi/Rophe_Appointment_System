import type { Doctor } from "./types";

// ---------------------------------------------------------------------------
// A colour per clinician, for the all-doctors calendar.
//
// Assigned by position in the doctor list rather than stored on the record:
// the colour means "not the same person as the one above", nothing more, and
// nobody should have to pick one when inviting a colleague.
//
// Deliberately not the status palette (teal/amber/rose) — a calendar showing
// both at once needs the two scales to stay tellable apart.
// ---------------------------------------------------------------------------

const TONES = [
  { bar: "bg-indigo-500", dot: "bg-indigo-500", text: "text-indigo-700", chip: "bg-indigo-100" },
  { bar: "bg-sky-500", dot: "bg-sky-500", text: "text-sky-700", chip: "bg-sky-100" },
  { bar: "bg-violet-500", dot: "bg-violet-500", text: "text-violet-700", chip: "bg-violet-100" },
  { bar: "bg-cyan-600", dot: "bg-cyan-600", text: "text-cyan-700", chip: "bg-cyan-100" },
  { bar: "bg-fuchsia-500", dot: "bg-fuchsia-500", text: "text-fuchsia-700", chip: "bg-fuchsia-100" },
  { bar: "bg-blue-600", dot: "bg-blue-600", text: "text-blue-700", chip: "bg-blue-100" },
] as const;

export type DoctorTone = (typeof TONES)[number];

/** Stable while the doctor list is stable, which is what the legend relies on. */
export function buildDoctorTones(doctors: Doctor[]): Map<string, DoctorTone> {
  return new Map(doctors.map((doctor, index) => [doctor.id, TONES[index % TONES.length]]));
}

/** "Dr. Akosua Mensah" → "A. Mensah", so a chip can name who without wrapping. */
export function shortDoctorName(fullName: string): string {
  const parts = fullName.replace(/^Dr\.?\s+/i, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
