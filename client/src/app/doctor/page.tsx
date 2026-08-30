"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  Clock,
  TrendingUp,
} from "lucide-react";
import { getAppointments, getDoctorAvailability, getPatients } from "@/lib/api";
import type { Appointment, DoctorAvailability, Patient } from "@/lib/types";
import { APPOINTMENT_STATUS_STYLES } from "@/lib/status-styles";
import { dateKey, fmtDate, fmtTime, startOfWeek, endOfWeek } from "@/lib/format";
import { availabilityLabel, weekDays } from "@/lib/schedule";
import { AppointmentDetailDialog } from "@/components/appointment-detail-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { PanelHeader, PanelLink, Pill } from "@/components/dashboard/panel";
import { cn } from "@/lib/utils";

const DOCTOR_ID = "doc-1";

export default function DoctorDashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [loading, setLoading] = useState(true);
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

  const todayKey = useMemo(() => dateKey(new Date()), []);
  const weekStartKey = useMemo(() => dateKey(startOfWeek(new Date())), []);
  const weekEndKey = useMemo(() => dateKey(endOfWeek(new Date())), []);

  const todays = useMemo(
    () =>
      appointments
        .filter((a) => a.date === todayKey && a.status !== "cancelled")
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, todayKey],
  );

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.date > todayKey && a.date <= weekEndKey)
        .filter((a) => a.status === "booked" || a.status === "confirmed")
        .sort((a, b) =>
          a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
        ),
    [appointments, todayKey, weekEndKey],
  );

  const weekStats = useMemo(() => {
    const inWeek = appointments.filter((a) => a.date >= weekStartKey && a.date <= weekEndKey);
    const attended = inWeek.filter((a) => a.status === "attended").length;
    const missed = inWeek.filter((a) => a.status === "missed").length;
    const denom = attended + missed;
    return {
      total: inWeek.length,
      attended,
      missed,
      attendanceRate: denom === 0 ? 0 : Math.round((attended / denom) * 100),
    };
  }, [appointments, weekStartKey, weekEndKey]);

  const openDayCount = useMemo(
    () => weekDays(new Date()).filter((day) => availabilityLabel(day, availability) !== null).length,
    [availability],
  );

  const openDays = useMemo(
    () =>
      weekDays(new Date()).map((day) => ({
        day,
        window: availabilityLabel(day, availability),
      })),
    [availability],
  );

  const nextUp = todays.find((a) => a.status === "booked" || a.status === "confirmed");

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-64 rounded-lg bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-200" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-surface bg-slate-100 p-4 sm:p-5">
        {/* Header */}
        <div className="mb-6">
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {nextUp && (
              <>
                {" · next up "}
                <span className="font-medium text-slate-700">
                  {fmtTime(nextUp.time)} with {patientName(nextUp.patientId)}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Quick stats — three, not four: this view is for orientation, not admin */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Today's appointments"
            value={String(todays.length)}
            icon={Clock}
            note={nextUp ? `Next at ${fmtTime(nextUp.time)}` : "Nothing left today"}
          />
          <StatCard
            label="Scheduled this week"
            value={String(weekStats.total)}
            icon={CalendarDays}
            note={`${openDayCount} clinic ${openDayCount === 1 ? "day" : "days"} open`}
          />
          <StatCard
            label="Attendance rate (this week)"
            value={`${weekStats.attendanceRate}%`}
            icon={TrendingUp}
            note={`${weekStats.attended} attended · ${weekStats.missed} missed`}
            tone={weekStats.missed > 0 ? "alert" : "accent"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {/* Today */}
            <Panel
              title="Today's schedule"
              count={todays.length}
              href="/doctor/schedule"
              linkLabel="Full schedule"
            >
              {todays.length === 0 ? (
                <Empty text="Nothing scheduled today." />
              ) : (
                <ul className="divide-y divide-slate-200">
                  {todays.map((a) => (
                    <li key={a.id}>
                      <Row
                        appt={a}
                        patientName={patientName(a.patientId)}
                        onSelect={() => setSelected(a)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Rest of week */}
            <Panel
              title="Later this week"
              count={upcoming.length}
              href="/doctor/schedule"
              linkLabel="View all"
            >
              {upcoming.length === 0 ? (
                <Empty text="Nothing else booked this week." />
              ) : (
                <ul className="divide-y divide-slate-200">
                  {upcoming.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <Row
                        appt={a}
                        patientName={patientName(a.patientId)}
                        showDate
                        onSelect={() => setSelected(a)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* Availability at a glance */}
          <section className="h-fit overflow-hidden rounded-panel bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">My availability</h2>
              </div>
              <Link
                href="/doctor/availability"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-700"
              >
                Edit
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <ul className="divide-y divide-slate-200">
              {openDays.map(({ day, window }) => {
                const key = dateKey(day);
                const isToday = key === todayKey;
                return (
                  <li
                    key={key}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5",
                      isToday && "bg-teal-100/50",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm",
                        isToday ? "font-semibold text-teal-800" : "text-slate-700",
                      )}
                    >
                      {day.toLocaleDateString("en-GB", { weekday: "long" })}
                    </span>
                    {window ? (
                      <span className="text-xs font-medium text-slate-600">{window}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <CalendarOff className="h-3 w-3" />
                        Closed
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
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

// --- sub-components -------------------------------------------------------

function Panel({
  title,
  count,
  href,
  linkLabel,
  children,
}: {
  title: string;
  count: number;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-panel bg-white">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex items-center gap-2">
          <PanelHeader title={title} />
          <Pill className="bg-slate-100 text-slate-600">{count}</Pill>
        </div>
        <PanelLink href={href}>{linkLabel}</PanelLink>
      </div>
      {children}
    </section>
  );
}

function Row({
  appt,
  patientName,
  showDate,
  onSelect,
}: {
  appt: Appointment;
  patientName: string;
  showDate?: boolean;
  onSelect: () => void;
}) {
  const style = APPOINTMENT_STATUS_STYLES[appt.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
    >
      <div className="flex w-16 shrink-0 flex-col">
        <span className="text-sm font-semibold text-slate-900">{fmtTime(appt.time)}</span>
        {showDate && <span className="text-[11px] text-slate-400">{fmtDate(appt.date)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{patientName}</p>
        <p className="truncate text-xs text-slate-500">
          {appt.appointmentType} · {appt.durationMinutes} min
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          style.badge,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
        {style.label}
      </span>
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-sm text-slate-400">{text}</p>;
}
