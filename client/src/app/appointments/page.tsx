"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import {
  getAppointments,
  getClinicAvailability,
  getDoctors,
  getPatients,
  getAppointmentTypes,
  getClinicSettings,
} from "@/lib/api";
import type { Appointment, Doctor, DoctorAvailability, Patient, ScheduleConfig } from "@/lib/types";
import { dateKey, fmtLongDate, startOfDay } from "@/lib/format";
import { addDays, forDoctor, weekDays } from "@/lib/schedule";
import { buildDoctorTones, shortDoctorName } from "@/lib/doctor-colors";
import { AppointmentDetailDialog } from "@/components/appointment-detail-dialog";
import {
  DayView,
  ListView,
  SCHEDULE_VIEWS,
  WeekView,
  type ScheduleView,
} from "@/components/schedule-views";
import { cn } from "@/lib/utils";

export default function AppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  /** "" is every clinician — the front desk's usual view of the day. */
  const [doctorFilter, setDoctorFilter] = useState("");
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<ScheduleView>("day");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Appointment | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [appts, pts, avail, docs, types, settings] = await Promise.all([
        getAppointments(),
        getPatients(),
        getClinicAvailability(),
        getDoctors(),
        getAppointmentTypes(),
        getClinicSettings(),
      ]);
      if (!active) return;
      setAppointments(appts);
      setPatients(pts);
      setAvailability(avail);
      setDoctors(docs);
      setConfig({ clinicSettings: settings, appointmentTypes: types.filter(t => t.isActive) });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const patientMap = useMemo(() => {
    const m = new Map<string, Patient>();
    patients.forEach((p) => m.set(p.id, p));
    return m;
  }, [patients]);

  const patientName = useCallback(
    (id: string) => patientMap.get(id)?.fullName ?? "Unknown patient",
    [patientMap],
  );

  const tones = useMemo(() => buildDoctorTones(doctors), [doctors]);
  const doctorMap = useMemo(
    () => new Map(doctors.map((d) => [d.id, d])),
    [doctors],
  );

  const shownAppointments = useMemo(
    () => (doctorFilter ? appointments.filter((a) => a.doctorId === doctorFilter) : appointments),
    [appointments, doctorFilter],
  );

  /**
   * With one clinician chosen the grid is their week. With all of them, a slot
   * reads as open when *somebody* is free — which is the question front desk is
   * actually asking before they pick who.
   */
  const shownAvailability = useMemo(
    () => (doctorFilter ? forDoctor(availability, doctorFilter) : availability),
    [availability, doctorFilter],
  );

  const showingEveryone = !doctorFilter && doctors.length > 1;

  const days = useMemo(() => weekDays(cursor), [cursor]);

  const step = useCallback(
    (direction: 1 | -1) => {
      setCursor((prev) => addDays(prev, view === "week" ? 7 * direction : direction));
    },
    [view],
  );

  // Booking a slot hands the chosen date/time to the booking form (Prompt 7).
  const startBooking = useCallback(
    (date: Date, time: string) => {
      const doctorParam = doctorFilter ? `&doctorId=${doctorFilter}` : "";
      router.push(`/appointments/book?date=${dateKey(date)}&time=${time}${doctorParam}`);
    },
    [router, doctorFilter],
  );

  const handleChanged = useCallback((updated: Appointment) => {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...updated } : a)));
    setSelected({ ...updated });
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-11 rounded-xl bg-slate-200" />
          <div className="h-[32rem] rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-surface bg-slate-100 p-4 sm:p-5">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mt-1 text-sm text-slate-500">
              {view === "week"
                ? `Week of ${fmtLongDate(dateKey(days[0]))}`
                : view === "day"
                  ? fmtLongDate(dateKey(cursor))
                  : "All scheduled appointments"}
            </p>
          </div>
          <Link
            href="/appointments/book"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            New appointment
          </Link>
        </div>

        {/* Toolbar: view toggle + date nav */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-panel bg-white p-1">
            {SCHEDULE_VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setView(v.value)}
                aria-pressed={view === v.value}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-semibold transition",
                  view === v.value
                    ? "bg-teal-100 text-teal-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          {view !== "list" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={view === "week" ? "Previous week" : "Previous day"}
                className="rounded-lg bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursor(startOfDay(new Date()))}
                className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={view === "week" ? "Next week" : "Next day"}
                className="rounded-lg bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {doctors.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-panel bg-white px-4 py-3">
            <label htmlFor="doctorFilter" className="text-xs font-medium text-slate-600">
              Doctor
            </label>
            <select
              id="doctorFilter"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm outline-none transition focus:ring-2 focus:ring-teal-600"
            >
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>

            {showingEveryone && (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {doctors.map((d) => (
                  <li key={d.id} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={cn("h-2.5 w-2.5 rounded-sm", tones.get(d.id)?.dot)} />
                    {shortDoctorName(d.fullName)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view === "day" && config && (
          <DayView
            date={cursor}
            appointments={shownAppointments}
            availability={shownAvailability}
            config={config}
            patientName={patientName}
            onSelect={setSelected}
            onBook={startBooking}
            doctorTone={showingEveryone ? (id) => tones.get(id) : undefined}
            doctorLabel={
              showingEveryone
                ? (id) => {
                    const name = doctorMap.get(id)?.fullName;
                    return name ? shortDoctorName(name) : undefined;
                  }
                : undefined
            }
          />
        )}

        {view === "week" && config && (
          <WeekView
            days={days}
            appointments={shownAppointments}
            availability={shownAvailability}
            config={config}
            patientName={patientName}
            onSelect={setSelected}
            onBook={startBooking}
            doctorTone={showingEveryone ? (id) => tones.get(id) : undefined}
            doctorLabel={
              showingEveryone
                ? (id) => {
                    const name = doctorMap.get(id)?.fullName;
                    return name ? shortDoctorName(name) : undefined;
                  }
                : undefined
            }
            onPickDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}

        {view === "list" && (
          <ListView
            appointments={shownAppointments}
            patientName={patientName}
            onSelect={setSelected}
          />
        )}

        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" />
          {showingEveryone
            ? "Greyed slots are outside every doctor's declared availability. Pick a doctor to see one clinician's week."
            : "Greyed slots fall outside the doctor's declared availability and can't be booked."}
        </p>
      </div>

      <AppointmentDetailDialog
        appointment={selected}
        patient={selected ? patientMap.get(selected.patientId) : undefined}
        onClose={() => setSelected(null)}
        onChanged={handleChanged}
      />
    </div>
  );
}
