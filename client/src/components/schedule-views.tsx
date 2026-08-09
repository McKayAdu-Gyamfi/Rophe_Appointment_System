"use client";

import { useMemo, useState } from "react";
import { CalendarOff, CalendarPlus } from "lucide-react";
import type { Appointment, DoctorAvailability } from "@/lib/types";
import { APPOINTMENT_STATUS_STYLES } from "@/lib/status-styles";
import { dateKey, fmtDate, fmtTime } from "@/lib/format";
import {
  availabilityLabel,
  buildDaySlots,
  daySlotTimes,
  isSlotAvailable,
  type DaySlot,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Day / week / list calendar views, shared by the staff Appointments screen
// and the doctor's My Schedule.
//
// Passing `onBook` makes empty slots clickable; omitting it renders a
// read-only calendar, which is what the doctor's view wants.
// ---------------------------------------------------------------------------

export type ScheduleView = "day" | "week" | "list";

export const SCHEDULE_VIEWS: { value: ScheduleView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "list", label: "List" },
];

interface SharedProps {
  appointments: Appointment[];
  availability: DoctorAvailability[];
  patientName: (id: string) => string;
  onSelect: (appointment: Appointment) => void;
  /** Omit for a read-only calendar. */
  onBook?: (date: Date, time: string) => void;
}

// --- day view --------------------------------------------------------------

export function DayView({
  date,
  appointments,
  availability,
  patientName,
  onSelect,
  onBook,
}: SharedProps & { date: Date }) {
  const slots = useMemo(
    () => buildDaySlots(date, appointments, availability),
    [date, appointments, availability],
  );
  const window = availabilityLabel(date, availability);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{fmtDate(dateKey(date))}</h2>
        {window ? (
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
            Available {window}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            <CalendarOff className="h-3.5 w-3.5" />
            Doctor unavailable
          </span>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {slots.map((slot) => (
          <li key={slot.time}>
            <SlotRow
              slot={slot}
              patientName={patientName}
              onSelect={onSelect}
              onBook={onBook ? () => onBook(date, slot.time) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlotRow({
  slot,
  patientName,
  onSelect,
  onBook,
}: {
  slot: DaySlot;
  patientName: (id: string) => string;
  onSelect: (appointment: Appointment) => void;
  onBook?: () => void;
}) {
  const hasAppointments = slot.appointments.length > 0;

  return (
    <div
      className={cn(
        "flex items-stretch gap-3 px-4 py-2",
        !slot.available && !hasAppointments && "bg-slate-50/70",
      )}
    >
      <span
        className={cn(
          "w-16 shrink-0 pt-2 text-xs font-medium",
          slot.available ? "text-slate-500" : "text-slate-300",
        )}
      >
        {fmtTime(slot.time)}
      </span>

      <div className="min-w-0 flex-1">
        {hasAppointments ? (
          <div className="space-y-1.5">
            {slot.appointments.map((appt) => (
              <AppointmentChip
                key={appt.id}
                appt={appt}
                patientName={patientName(appt.patientId)}
                onClick={() => onSelect(appt)}
              />
            ))}
          </div>
        ) : slot.occupied ? (
          <div className="flex h-9 items-center rounded-lg border border-dashed border-slate-200 px-3 text-xs text-slate-400">
            In progress
          </div>
        ) : slot.available ? (
          onBook ? (
            <button
              type="button"
              onClick={onBook}
              className="group flex h-9 w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 text-xs font-medium text-slate-400 transition hover:border-teal-300 hover:bg-teal-50/60 hover:text-teal-700"
            >
              <CalendarPlus className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
              Available — click to book
            </button>
          ) : (
            <div className="flex h-9 items-center rounded-lg border border-dashed border-slate-200 px-3 text-xs text-slate-400">
              Free
            </div>
          )
        ) : (
          <div className="flex h-9 items-center rounded-lg bg-slate-100/70 px-3 text-xs text-slate-400">
            Unavailable
          </div>
        )}
      </div>
    </div>
  );
}

function AppointmentChip({
  appt,
  patientName,
  onClick,
}: {
  appt: Appointment;
  patientName: string;
  onClick: () => void;
}) {
  const style = APPOINTMENT_STATUS_STYLES[appt.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:brightness-95",
        style.badge,
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{patientName}</span>
        <span className="block truncate text-xs opacity-80">
          {appt.appointmentType} · {appt.durationMinutes} min
        </span>
      </span>
      <span className="shrink-0 text-xs font-medium opacity-80">{style.label}</span>
    </button>
  );
}

// --- week view -------------------------------------------------------------

export function WeekView({
  days,
  appointments,
  availability,
  patientName,
  onSelect,
  onBook,
  onPickDay,
}: SharedProps & { days: Date[]; onPickDay: (date: Date) => void }) {
  const times = useMemo(() => daySlotTimes(), []);
  const todayKey = dateKey(new Date());

  const byDay = useMemo(
    () =>
      days.map((day) => ({
        day,
        slots: buildDaySlots(day, appointments, availability),
      })),
    [days, appointments, availability],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[52rem]">
        {/* Day headers */}
        <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-slate-100 bg-slate-50/60">
          <span />
          {days.map((day) => {
            const key = dateKey(day);
            const isToday = key === todayKey;
            const window = availabilityLabel(day, availability);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPickDay(day)}
                className="border-l border-slate-100 px-2 py-2.5 text-center transition hover:bg-white"
              >
                <span
                  className={cn(
                    "block text-xs font-semibold",
                    isToday ? "text-teal-700" : "text-slate-600",
                  )}
                >
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isToday ? "bg-teal-600 font-semibold text-white" : "text-slate-500",
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="mt-1 block text-[10px] text-slate-400">{window ?? "Closed"}</span>
              </button>
            );
          })}
        </div>

        {/* Slot grid */}
        {times.map((time) => (
          <div
            key={time}
            className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-slate-50 last:border-b-0"
          >
            <span className="px-2 py-1.5 text-right text-[11px] font-medium text-slate-400">
              {fmtTime(time)}
            </span>
            {byDay.map(({ day, slots }) => {
              const slot = slots.find((s) => s.time === time);
              const available = slot?.available ?? isSlotAvailable(day, time, availability);
              const appts = slot?.appointments ?? [];

              return (
                <div
                  key={`${dateKey(day)}-${time}`}
                  className={cn(
                    "border-l border-slate-100 p-0.5",
                    !available && appts.length === 0 && "bg-slate-50/70",
                  )}
                >
                  {appts.length > 0 ? (
                    appts.map((appt) => {
                      const style = APPOINTMENT_STATUS_STYLES[appt.status];
                      return (
                        <button
                          key={appt.id}
                          type="button"
                          onClick={() => onSelect(appt)}
                          title={`${patientName(appt.patientId)} — ${appt.appointmentType} (${style.label})`}
                          className={cn(
                            "flex w-full items-center gap-1 rounded px-1.5 py-1 text-left transition hover:brightness-95",
                            style.badge,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
                          <span className="truncate text-[11px] font-medium">
                            {patientName(appt.patientId)}
                          </span>
                        </button>
                      );
                    })
                  ) : slot?.occupied ? (
                    <div className="h-6 rounded bg-slate-100/80" />
                  ) : available && onBook ? (
                    <button
                      type="button"
                      onClick={() => onBook(day, time)}
                      aria-label={`Book ${fmtDate(dateKey(day))} at ${fmtTime(time)}`}
                      className="h-6 w-full rounded transition hover:bg-teal-50"
                    />
                  ) : (
                    <div className="h-6" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- list view -------------------------------------------------------------

export function ListView({
  appointments,
  patientName,
  onSelect,
  emptyLabel = "appointments",
}: Pick<SharedProps, "appointments" | "patientName" | "onSelect"> & {
  emptyLabel?: string;
}) {
  const [showPast, setShowPast] = useState(false);
  const todayKey = dateKey(new Date());

  const rows = useMemo(() => {
    const filtered = appointments.filter((a) =>
      showPast ? a.date < todayKey : a.date >= todayKey,
    );
    return filtered.sort((a, b) => {
      const byDate = showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      return byDate !== 0 ? byDate : a.time.localeCompare(b.time);
    });
  }, [appointments, showPast, todayKey]);

  // Group by date so the list reads like a diary rather than a flat table.
  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    rows.forEach((a) => {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    });
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {showPast ? `Past ${emptyLabel}` : `Upcoming ${emptyLabel}`}
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {rows.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {showPast ? "Show upcoming" : "Show past"}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-slate-400">
          No {showPast ? "past" : "upcoming"} {emptyLabel}.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-2 bg-slate-50/60 px-4 py-2">
                <span className="text-xs font-semibold text-slate-600">{fmtDate(date)}</span>
                {date === todayKey && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                    Today
                  </span>
                )}
              </div>
              <ul className="divide-y divide-slate-50">
                {items.map((appt) => {
                  const style = APPOINTMENT_STATUS_STYLES[appt.status];
                  return (
                    <li key={appt.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(appt)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span className="w-16 shrink-0 text-sm font-semibold text-slate-900">
                          {fmtTime(appt.time)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {patientName(appt.patientId)}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {appt.appointmentType} · {appt.durationMinutes} min
                          </span>
                        </span>
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
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
