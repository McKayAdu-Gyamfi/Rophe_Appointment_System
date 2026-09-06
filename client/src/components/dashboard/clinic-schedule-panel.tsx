"use client";

import { useMemo } from "react";
import type { Appointment, Doctor, DoctorAvailability, ScheduleConfig } from "@/lib/types";
import { dateKey, initials, startOfWeek } from "@/lib/format";
import { addDays, availabilityLabel, bookableSlots, forDoctor } from "@/lib/schedule";
import { buildDoctorTones } from "@/lib/doctor-colors";
import { Panel, PanelHeader, PanelMenuLink, Pill } from "./panel";
import { cn } from "@/lib/utils";

// The reference's "Doctors' Schedule": a three-figure summary strip over rows
// with an availability badge.
//
// What the rows are depends on the clinic. With one clinician the open/closed
// answer varies by day, so the rows are the week. With several it varies by
// person first — "who is in, and how full are they" is the question at the
// front desk — so the rows become the roster and the week collapses into each
// doctor's working days.
export function ClinicSchedulePanel({
  doctors,
  availability,
  appointments,
  config,
}: {
  doctors: Doctor[];
  availability: DoctorAvailability[];
  appointments: Appointment[];
  config: ScheduleConfig;
}) {
  if (doctors.length > 1) {
    return (
      <RosterPanel
        doctors={doctors}
        availability={availability}
        appointments={appointments}
        config={config}
      />
    );
  }

  return (
    <SingleDoctorPanel
      doctor={doctors[0]}
      availability={availability}
      appointments={appointments}
      config={config}
    />
  );
}

/** Rows are the roster: who works which days, and how full they are. */
function RosterPanel({
  doctors,
  availability,
  appointments,
  config,
}: {
  doctors: Doctor[];
  availability: DoctorAvailability[];
  appointments: Appointment[];
  config: ScheduleConfig;
}) {
  const tones = useMemo(() => buildDoctorTones(doctors), [doctors]);

  const rows = useMemo(() => {
    const start = startOfWeek(new Date());
    const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    return doctors.map((doctor) => {
      const own = forDoctor(availability, doctor.id);
      const ownAppointments = appointments.filter(
        (a) => a.doctorId === doctor.id && a.status !== "cancelled",
      );

      const workingDays = week.filter((date) => availabilityLabel(date, own) !== null);
      const booked = week.reduce(
        (sum, date) => sum + ownAppointments.filter((a) => a.date === dateKey(date)).length,
        0,
      );
      const free = week.reduce(
        (sum, date) => sum + bookableSlots(date, ownAppointments, own, config).length,
        0,
      );

      return {
        doctor,
        booked,
        free,
        days: workingDays.map((d) => d.toLocaleDateString("en-GB", { weekday: "short" })),
      };
    });
  }, [doctors, availability, appointments, config]);

  const totals = {
    doctors: doctors.length,
    booked: rows.reduce((s, r) => s + r.booked, 0),
    free: rows.reduce((s, r) => s + r.free, 0),
  };

  return (
    <Panel>
      <PanelHeader
        title="Clinic schedule"
        action={<PanelMenuLink href="/appointments" label="Open calendar" />}
      />

      <dl className="mt-4 grid grid-cols-3 rounded-panel bg-slate-100 py-3 text-center">
        {[
          { label: "Doctors", value: totals.doctors },
          { label: "Booked", value: totals.booked },
          { label: "Free slots", value: totals.free },
        ].map((stat) => (
          <div key={stat.label}>
            <dd className="tnum text-xl font-bold leading-none text-teal-900">{stat.value}</dd>
            <dt className="mt-1 text-[11px] font-medium text-slate-500">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <ul className="mt-3 divide-y divide-slate-200">
        {rows.map((row) => (
          <li key={row.doctor.id} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                tones.get(row.doctor.id)?.bar ?? "bg-slate-400",
              )}
            >
              {initials(row.doctor.fullName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-slate-900">
                {row.doctor.fullName}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {row.days.length > 0 ? row.days.join(", ") : "No hours set"} · {row.booked} booked
              </span>
            </span>
            <Pill
              className={
                row.days.length > 0 ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
              }
            >
              {row.days.length > 0 ? `${row.free} free` : "Closed"}
            </Pill>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** One clinician: the open/closed answer varies by day, so the rows are days. */
function SingleDoctorPanel({
  doctor,
  availability,
  appointments,
  config,
}: {
  doctor: Doctor | undefined;
  availability: DoctorAvailability[];
  appointments: Appointment[];
  config: ScheduleConfig;
}) {
  const { days, openDays, booked, free } = useMemo(() => {
    const start = startOfWeek(new Date());
    const todayKey = dateKey(new Date());

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const key = dateKey(date);
      const window = availabilityLabel(date, availability);
      const dayAppointments = appointments.filter(
        (a) => a.date === key && a.status !== "cancelled",
      );

      return {
        key,
        isToday: key === todayKey,
        weekday: date.toLocaleDateString("en-GB", { weekday: "long" }),
        dayLabel: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        window,
        booked: dayAppointments.length,
        free: bookableSlots(date, appointments, availability, config).length,
      };
    });

    return {
      days,
      openDays: days.filter((d) => d.window !== null).length,
      booked: days.reduce((s, d) => s + d.booked, 0),
      free: days.reduce((s, d) => s + d.free, 0),
    };
  }, [availability, appointments, config]);

  const openOrToday = days.filter((d) => d.window !== null || d.isToday);
  const closedDays = days
    .filter((d) => d.window === null && !d.isToday)
    .map((d) => d.weekday.slice(0, 3));

  return (
    <Panel>
      <PanelHeader
        title="Clinic schedule"
        action={<PanelMenuLink href="/doctor/availability" label="Edit availability" />}
      />

      {doctor && (
        <div className="mt-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
            {initials(doctor.fullName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold text-slate-900">
              {doctor.fullName}
            </span>
            <span className="block truncate text-[11px] text-slate-500">{doctor.specialty}</span>
          </span>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 rounded-panel bg-slate-100 py-3 text-center">
        {[
          { label: "Open days", value: openDays },
          { label: "Booked", value: booked },
          { label: "Free slots", value: free },
        ].map((stat) => (
          <div key={stat.label}>
            <dd className="tnum text-xl font-bold leading-none text-teal-900">{stat.value}</dd>
            <dt className="mt-1 text-[11px] font-medium text-slate-500">{stat.label}</dt>
          </div>
        ))}
      </dl>

      {/* Closed days get one shared line rather than a row each — a row that
          only ever says "Closed" earns none of the height it takes. */}
      <ul className="mt-3 divide-y divide-slate-200">
        {openOrToday.map((day) => (
          <li key={day.key} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[13px] font-semibold",
                  day.isToday ? "text-teal-700" : "text-slate-900",
                )}
              >
                {day.weekday}
                {day.isToday && " · today"}
              </span>
              <span className="tnum block truncate text-[11px] text-slate-500">
                {day.window ?? "No clinic hours"} · {day.dayLabel}
              </span>
            </span>

            <Pill
              className={
                day.window ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
              }
            >
              {day.window ? `${day.free} free` : "Closed"}
            </Pill>
          </li>
        ))}
      </ul>

      {closedDays.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          Closed {closedDays.join(", ")}
        </p>
      )}
    </Panel>
  );
}
