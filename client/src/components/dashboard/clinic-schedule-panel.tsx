"use client";

import { useMemo } from "react";
import type { Appointment, Doctor, DoctorAvailability, ScheduleConfig } from "@/lib/types";
import { dateKey, initials, startOfWeek } from "@/lib/format";
import { addDays, availabilityLabel, bookableSlots } from "@/lib/schedule";
import { Panel, PanelHeader, PanelMenuLink, Pill } from "./panel";
import { cn } from "@/lib/utils";

// Stands in for the reference's "Doctors' Schedule": the same three-figure
// summary strip over a list of rows with an availability badge. The clinic
// runs one specialist, so the rows are the days of the week rather than a
// roster of doctors — that's where the open/closed answer actually varies.
export function ClinicSchedulePanel({
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
