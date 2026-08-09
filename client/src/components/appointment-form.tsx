"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, Check, Loader2, Search, UserPlus, X } from "lucide-react";
import {
  bookAppointment,
  getAppointments,
  getDoctorAvailability,
  getDoctors,
  getPatients,
  sendMessage,
  updateAppointment,
} from "@/lib/api";
import type { Appointment, Doctor, DoctorAvailability, Patient } from "@/lib/types";
import { CHANNEL_STYLES } from "@/lib/status-styles";
import { dateKey, fmtDate, fmtLongDate, fmtTime, initials } from "@/lib/format";
import {
  availabilityLabel,
  buildDaySlots,
  toMinutes,
  windowContaining,
} from "@/lib/schedule";
import { NewPatientDialog } from "./new-patient-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Book / reschedule appointment (PRD Section 3.1 #5, Section 6 #1).
//
// One component serves both flows: booking picks a patient, rescheduling keeps
// the existing one and moves the slot. Either way the submit path is
// book/update → simulated confirmation message → message log entry → toast.
// ---------------------------------------------------------------------------

const APPOINTMENT_TYPES = [
  "Consultation",
  "Follow-up",
  "Hypertension Review",
  "Diabetes Review",
  "General Check-up",
];

const DURATIONS = [15, 30, 45, 60];

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export interface AppointmentFormProps {
  /** Existing appointment = reschedule mode. */
  appointment?: Appointment;
  initialPatientId?: string;
  initialDate?: string;
  initialTime?: string;
}

export function AppointmentForm({
  appointment,
  initialPatientId,
  initialDate,
  initialTime,
}: AppointmentFormProps) {
  const router = useRouter();
  const isReschedule = Boolean(appointment);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [doctor, setDoctor] = useState<Doctor | undefined>();
  const [loading, setLoading] = useState(true);

  const [patientId, setPatientId] = useState(appointment?.patientId ?? initialPatientId ?? "");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [type, setType] = useState(appointment?.appointmentType ?? APPOINTMENT_TYPES[0]);
  const [date, setDate] = useState(appointment?.date ?? initialDate ?? dateKey(new Date()));
  const [time, setTime] = useState(appointment?.time ?? initialTime ?? "");
  const [duration, setDuration] = useState(appointment?.durationMinutes ?? 30);
  const [notes, setNotes] = useState(appointment?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [pts, appts, avail, docs] = await Promise.all([
        getPatients(),
        getAppointments(),
        getDoctorAvailability(),
        getDoctors(),
      ]);
      if (!active) return;
      setPatients(pts);
      setAppointments(appts);
      setAvailability(avail);
      setDoctor(docs[0]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId),
    [patients, patientId],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qDigits = digits(query);
    return patients
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          (qDigits.length >= 2 && digits(p.phone).includes(qDigits)),
      )
      .slice(0, 6);
  }, [patients, query]);

  const selectedDate = useMemo(() => new Date(`${date}T00:00:00`), [date]);

  // When rescheduling, the appointment's own slot shouldn't count as taken.
  const otherAppointments = useMemo(
    () => appointments.filter((a) => a.id !== appointment?.id),
    [appointments, appointment?.id],
  );

  const slots = useMemo(
    () => buildDaySlots(selectedDate, otherAppointments, availability),
    [selectedDate, otherAppointments, availability],
  );

  const openLabel = availabilityLabel(selectedDate, availability);

  // The specific open window the chosen slot sits in — a day can have several.
  const activeWindow = useMemo(
    () => (time ? windowContaining(selectedDate, time, availability) : undefined),
    [selectedDate, time, availability],
  );

  // A 45-minute visit can't start in the last 30 minutes of the clinic window.
  const fitsInWindow = useMemo(() => {
    if (!time || !activeWindow) return true;
    return toMinutes(time) + duration <= toMinutes(activeWindow.endTime);
  }, [time, duration, activeWindow]);

  const isSlotBookable = (candidate: string) => {
    const slot = slots.find((s) => s.time === candidate);
    return Boolean(slot?.available) && slot!.appointments.length === 0 && !slot!.occupied;
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!patientId) return setError("Select a patient for this appointment.");
    if (!openLabel) return setError("The doctor isn't available on that day — pick another date.");
    if (!time) return setError("Pick an available time slot.");
    if (!isSlotBookable(time)) {
      return setError("That slot is no longer available — pick another.");
    }
    if (!fitsInWindow) {
      return setError(
        `A ${duration}-minute appointment starting at ${fmtTime(time)} runs past the doctor's ${activeWindow?.endTime} finish.`,
      );
    }
    if (!isReschedule && date < dateKey(new Date())) {
      return setError("That date is in the past.");
    }

    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return setError("That patient could no longer be found.");

    setSubmitting(true);
    try {
      const doctorName = doctor?.fullName ?? "the doctor";
      const when = `${fmtDate(date)} at ${fmtTime(time)}`;

      const saved = isReschedule
        ? await updateAppointment(appointment!.id, {
            appointmentType: type,
            date,
            time,
            durationMinutes: duration,
            notes: notes.trim() || undefined,
            status: "rescheduled",
          })
        : await bookAppointment({
            patientId,
            doctorId: doctor?.id ?? "doc-1",
            appointmentType: type,
            date,
            time,
            durationMinutes: duration,
            notes: notes.trim() || undefined,
          });

      if (!saved) {
        setError("Couldn't save that appointment. Try again.");
        return;
      }

      // Simulated confirmation — logged, never actually sent.
      const channelLabel = CHANNEL_STYLES[patient.preferredChannel].label;
      const preview = isReschedule
        ? `Your appointment with ${doctorName} has been moved to ${when}.`
        : `Your appointment with ${doctorName} is confirmed for ${when}.`;

      await sendMessage({
        patientId: patient.id,
        appointmentId: saved.id,
        channel: patient.preferredChannel,
        type: "confirmation",
        contentPreview: preview,
      });

      toast.success(`Confirmation sent via ${channelLabel}`, { description: preview });
      router.push("/appointments");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-xl bg-slate-200" />
        <div className="h-64 rounded-xl bg-slate-200" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* 1. Patient */}
      <Section step={1} title="Patient">
        {selectedPatient ? (
          <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-teal-700">
              {initials(selectedPatient.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {selectedPatient.fullName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {selectedPatient.phone} · prefers{" "}
                {CHANNEL_STYLES[selectedPatient.preferredChannel].label}
              </p>
            </div>
            {!isReschedule && (
              <button
                type="button"
                onClick={() => {
                  setPatientId("");
                  setQuery("");
                }}
                aria-label="Change patient"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or phone"
                  aria-label="Search patients"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <UserPlus className="h-4 w-4" />
                New patient
              </button>
            </div>

            {query.trim() && (
              <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {matches.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-slate-400">
                    No patient matches “{query}”.
                  </li>
                ) : (
                  matches.map((p) => (
                    <li key={p.id} className="border-b border-slate-50 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPatientId(p.id);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                          {initials(p.fullName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {p.fullName}
                          </span>
                          <span className="block truncate text-xs text-slate-500">{p.phone}</span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* 2. Type & duration */}
      <Section step={2} title="Appointment details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-slate-700">
              Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="duration" className="mb-1.5 block text-sm font-medium text-slate-700">
              Duration
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* 3. Date & slot */}
      <Section step={3} title="Date & time">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime(""); // a slot on one day means nothing on another
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <p className="pb-2.5 text-xs text-slate-500">{fmtLongDate(date)}</p>
          </div>

          {openLabel ? (
            <>
              <p className="text-xs font-medium text-teal-700">
                {doctor?.fullName ?? "Doctor"} is available {openLabel} on this day.
              </p>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => {
                  const taken = slot.appointments.length > 0 || slot.occupied;
                  const disabled = !slot.available || taken;
                  const active = time === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={disabled}
                      onClick={() => setTime(slot.time)}
                      title={
                        !slot.available
                          ? "Outside the doctor's availability"
                          : taken
                            ? "Already booked"
                            : undefined
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                        active
                          ? "border-teal-400 bg-teal-600 text-white shadow-sm"
                          : disabled
                            ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                            : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50",
                      )}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                      {fmtTime(slot.time)}
                    </button>
                  );
                })}
              </div>
              {!fitsInWindow && time && (
                <p className="text-xs font-medium text-amber-700">
                  A {duration}-minute appointment at {fmtTime(time)} runs past the{" "}
                  {activeWindow?.endTime} finish time.
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
              <CalendarOff className="h-4 w-4 shrink-0 text-slate-400" />
              {doctor?.fullName ?? "The doctor"} isn&apos;t available on{" "}
              {selectedDate.toLocaleDateString("en-GB", { weekday: "long" })}s. Choose another
              date.
            </div>
          )}
        </div>
      </Section>

      {/* 4. Notes */}
      <Section step={4} title="Notes">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the doctor should know before the visit."
          aria-label="Appointment notes"
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </Section>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isReschedule ? "Save & reschedule" : "Book appointment"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        {selectedPatient && (
          <p className="text-xs text-slate-500">
            A confirmation will be sent via{" "}
            <span className="font-semibold text-slate-700">
              {CHANNEL_STYLES[selectedPatient.preferredChannel].label}
            </span>
            .
          </p>
        )}
      </div>

      <NewPatientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(patient) => {
          setPatients((prev) => [...prev, patient]);
          setPatientId(patient.id);
          setQuery("");
          toast.success(`${patient.fullName} added`, {
            description: "Continue booking their appointment.",
          });
        }}
      />
    </form>
  );
}

// --- layout helper --------------------------------------------------------

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="pl-0 sm:pl-9">{children}</div>
    </section>
  );
}
