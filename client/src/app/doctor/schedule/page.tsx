"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { getAppointments, getDoctorAvailability, getPatients } from "@/lib/api";
import type { Appointment, DoctorAvailability, Patient } from "@/lib/types";
import { dateKey, fmtLongDate, startOfDay } from "@/lib/format";
import { addDays, weekDays } from "@/lib/schedule";
import { AppointmentDetailDialog } from "@/components/appointment-detail-dialog";
import {
  DayView,
  ListView,
  SCHEDULE_VIEWS,
  WeekView,
  type ScheduleView,
} from "@/components/schedule-views";
import { cn } from "@/lib/utils";

const DOCTOR_ID = "doc-1";

export default function DoctorSchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<ScheduleView>("day");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Appointment | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [appts, pts, avail] = await Promise.all([
        getAppointments(),
        getPatients(),
        getDoctorAvailability(DOCTOR_ID),
      ]);
      if (!active) return;
      // Only this doctor's own appointments (PRD Section 3.2 #3).
      setAppointments(appts.filter((a) => a.doctorId === DOCTOR_ID));
      setPatients(pts);
      setAvailability(avail);
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

  const days = useMemo(() => weekDays(cursor), [cursor]);

  const step = useCallback(
    (direction: 1 | -1) => {
      setCursor((prev) => addDays(prev, view === "week" ? 7 * direction : direction));
    },
    [view],
  );

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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mt-1 text-sm text-slate-500">
              {view === "week"
                ? `Week of ${fmtLongDate(dateKey(days[0]))}`
                : view === "day"
                  ? fmtLongDate(dateKey(cursor))
                  : "All my appointments"}
            </p>
          </div>
          <Link
            href="/doctor/availability"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <CalendarCheck className="h-4 w-4" />
            My availability
          </Link>
        </div>

        {/* Toolbar */}
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

        {/* No onBook — the doctor's view is read-only; front desk does the booking. */}
        {view === "day" && (
          <DayView
            date={cursor}
            appointments={appointments}
            availability={availability}
            patientName={patientName}
            onSelect={setSelected}
          />
        )}

        {view === "week" && (
          <WeekView
            days={days}
            appointments={appointments}
            availability={availability}
            patientName={patientName}
            onSelect={setSelected}
            onPickDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}

        {view === "list" && (
          <ListView
            appointments={appointments}
            patientName={patientName}
            onSelect={setSelected}
            emptyLabel="visits"
          />
        )}

        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Eye className="h-3.5 w-3.5" />
          Read-only view — front desk books and edits appointments. Tap one to see the patient&apos;s
          details.
        </p>
      </div>

      <AppointmentDetailDialog
        appointment={selected}
        patient={selected ? patientMap.get(selected.patientId) : undefined}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...updated } : a)));
          setSelected({ ...updated });
        }}
      />
    </div>
  );
}
