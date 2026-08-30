"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarCheck, Info, Loader2, Repeat } from "lucide-react";
import { getAppointments, getDoctorAvailability, setDoctorDayAvailability } from "@/lib/api";
import type { Appointment, DoctorAvailability } from "@/lib/types";
import { dateKey, fmtTime } from "@/lib/format";
import {
  daySlotTimes,
  isSlotAvailable,
  mergeSlotsIntoWindows,
  toMinutes,
  windowsForDate,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

const DOCTOR_ID = "doc-1";

const DAYS = [
  { index: 1, label: "Monday", short: "Mon" },
  { index: 2, label: "Tuesday", short: "Tue" },
  { index: 3, label: "Wednesday", short: "Wed" },
  { index: 4, label: "Thursday", short: "Thu" },
  { index: 5, label: "Friday", short: "Fri" },
  { index: 6, label: "Saturday", short: "Sat" },
  { index: 0, label: "Sunday", short: "Sun" },
];

/**
 * Monday of the week we're currently in. The pattern below is weekday-based,
 * not date-based, but the columns show this week's dates so the doctor can
 * anchor "Wednesday" to an actual day. Picking the *next* occurrence of each
 * weekday instead would produce a set of dates spanning two different weeks.
 */
/** "11 Aug" */
function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function mondayOfCurrentWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

export default function DoctorAvailabilityPage() {
  const times = useMemo(() => daySlotTimes(), []);

  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [avail, appts] = await Promise.all([
        getDoctorAvailability(DOCTOR_ID),
        getAppointments(),
      ]);
      if (!active) return;
      setAvailability(avail);
      setAppointments(appts.filter((a) => a.doctorId === DOCTOR_ID));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // DAYS runs Mon→Sun, so column i is Monday + i days.
  const weekStart = useMemo(() => mondayOfCurrentWeek(), []);
  const todayKey = useMemo(() => dateKey(new Date()), []);

  const dayDates = useMemo(() => {
    const map = new Map<number, Date>();
    DAYS.forEach(({ index }, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      map.set(index, d);
    });
    return map;
  }, [weekStart]);

  const openTimesFor = useCallback(
    (dayOfWeek: number) => {
      const date = dayDates.get(dayOfWeek)!;
      return times.filter((time) => isSlotAvailable(date, time, availability));
    },
    [times, availability, dayDates],
  );

  /**
   * Appointments already booked into a weekday's slot. Closing a slot with a
   * patient in it doesn't delete the appointment, so warn rather than block —
   * front desk still needs to move it.
   */
  const bookedTimesFor = useCallback(
    (dayOfWeek: number) => {
      const booked = new Set<string>();
      appointments
        .filter((a) => a.status !== "cancelled")
        .forEach((a) => {
          const apptDate = new Date(`${a.date}T00:00:00`);
          if (apptDate.getDay() !== dayOfWeek) return;
          if (apptDate < new Date(new Date().setHours(0, 0, 0, 0))) return; // past visits can't clash
          const start = toMinutes(a.time);
          times.forEach((t) => {
            const slot = toMinutes(t);
            if (slot >= start && slot < start + a.durationMinutes) booked.add(t);
          });
        });
      return booked;
    },
    [appointments, times],
  );

  const persist = useCallback(async (dayOfWeek: number, openTimes: string[]) => {
    const windows = mergeSlotsIntoWindows(DOCTOR_ID, dayOfWeek, openTimes);
    setSavingDay(dayOfWeek);
    try {
      await setDoctorDayAvailability(DOCTOR_ID, dayOfWeek, windows);
      const fresh = await getDoctorAvailability(DOCTOR_ID);
      setAvailability(fresh);
    } catch {
      toast.error("Couldn't save that change. Try again.");
    } finally {
      setSavingDay(null);
    }
  }, []);

  const toggleSlot = useCallback(
    (dayOfWeek: number, time: string) => {
      const open = openTimesFor(dayOfWeek);
      const isOpen = open.includes(time);
      const next = isOpen ? open.filter((t) => t !== time) : [...open, time];

      const booked = bookedTimesFor(dayOfWeek);
      if (isOpen && booked.has(time)) {
        toast.warning(`${fmtTime(time)} has a patient booked`, {
          description: "The slot is closed for new bookings — front desk should move that visit.",
        });
      }

      void persist(dayOfWeek, next);
    },
    [openTimesFor, bookedTimesFor, persist],
  );

  const toggleDay = useCallback(
    (dayOfWeek: number) => {
      const open = openTimesFor(dayOfWeek);
      void persist(dayOfWeek, open.length > 0 ? [] : times);
    },
    [openTimesFor, persist, times],
  );

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-[34rem] rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-surface bg-slate-100 p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mt-1 text-sm text-slate-500">
              The hours you normally work. This pattern repeats every week until you change it.
            </p>
          </div>
          <Link
            href="/doctor/schedule"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <CalendarCheck className="h-4 w-4" />
            My schedule
          </Link>
        </div>

        {/* How this works — the page is a repeating template, not a diary, and
            that distinction isn't obvious sitting next to "My schedule". */}
        <div className="mb-5 rounded-panel bg-white p-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-900">How this works</h2>
          </div>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              {
                n: 1,
                title: "Set your usual week",
                body: "Tap slots to open or close them. A closed day just means you don't normally work it.",
              },
              {
                n: 2,
                title: "It repeats weekly",
                body: "The same pattern applies to every week ahead — you don't set it date by date.",
              },
              {
                n: 3,
                title: "Front desk books inside it",
                body: "Only open slots can be booked. Appointments already in the diary aren't moved.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[11px] font-semibold text-teal-700">
                  {step.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800">{step.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Reference week */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
          <p className="text-xs text-slate-500">
            Dates shown are{" "}
            <span className="font-medium text-slate-700">
              this week ({fmtDayMonth(weekStart)} – {fmtDayMonth(addDays(weekStart, 6))})
            </span>{" "}
            — for reference only, so you can picture the days.
          </p>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto rounded-panel bg-white">
          <div className="min-w-[46rem]">
            {/* Header row: day names + whole-day toggle */}
            <div className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-100">
              <span />
              {DAYS.map(({ index, label, short }) => {
                const open = openTimesFor(index);
                const saving = savingDay === index;
                const date = dayDates.get(index)!;
                const isToday = dateKey(date) === todayKey;
                return (
                  <div
                    key={index}
                    className={cn(
                      "border-l border-slate-200 px-2 py-2.5 text-center",
                      isToday && "bg-teal-100/60",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-xs font-semibold",
                        isToday ? "text-teal-800" : "text-slate-700",
                      )}
                    >
                      {short}
                    </span>
                    <span
                      className={cn(
                        "block text-[10px]",
                        isToday ? "font-medium text-teal-700" : "text-slate-400",
                      )}
                    >
                      {isToday ? "Today" : fmtDayMonth(date)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleDay(index)}
                      disabled={savingDay !== null}
                      aria-label={
                        open.length > 0
                          ? `Close every ${label}`
                          : `Open every ${label} for booking`
                      }
                      title={
                        open.length > 0
                          ? `Close every ${label}`
                          : `Open every ${label} for booking`
                      }
                      className={cn(
                        "mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-50",
                        open.length > 0
                          ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                          : "bg-slate-200 text-slate-500 hover:bg-slate-300",
                      )}
                    >
                      {saving && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      {open.length > 0 ? `${open.length} open` : "Not working"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Slot rows */}
            {times.map((time) => (
              <div
                key={time}
                className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] border-b border-slate-50 last:border-b-0"
              >
                <span className="px-2 py-1 text-right text-[11px] font-medium text-slate-400">
                  {fmtTime(time)}
                </span>
                {DAYS.map(({ index, label }) => {
                  const date = dayDates.get(index)!;
                  const open = isSlotAvailable(date, time, availability);
                  const booked = bookedTimesFor(index).has(time);

                  return (
                    <div key={`${index}-${time}`} className="border-l border-slate-200 p-0.5">
                      <button
                        type="button"
                        onClick={() => toggleSlot(index, time)}
                        disabled={savingDay !== null}
                        aria-pressed={open}
                        aria-label={`${label} ${fmtTime(time)} — ${open ? "open" : "closed"}`}
                        title={
                          booked
                            ? "A patient is booked in this slot"
                            : open
                              ? "Open — click to close"
                              : "Closed — click to open"
                        }
                        className={cn(
                          "flex h-7 w-full items-center justify-center rounded text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                          // Open slots are filled, not tinted: a light blue at
                          // this size is indistinguishable from a closed grey
                          // cell, which is the whole point of the grid.
                          open
                            ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                            : "bg-slate-100 text-transparent hover:bg-slate-200",
                        )}
                      >
                        {booked && open ? "●" : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend + summary */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-teal-100 ring-1 ring-teal-200" />
            Open for booking
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-200" />
            Not working
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-teal-700">●</span>
            Patient already booked
          </span>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            Changes save immediately and apply to <strong className="font-semibold">every</strong>{" "}
            week from now on.{" "}
            <Link href="/appointments" className="font-medium text-teal-700 hover:underline">
              The front-desk calendar
            </Link>{" "}
            picks them up straight away. Need a <em>one-off</em> change — a single day off for a
            conference, say? That isn&apos;t supported yet; ask front desk to move those
            appointments.
          </p>
        </div>

        {/* Plain-English restatement of the grid above */}
        <div className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Your usual week</h2>
          <p className="mb-3 text-xs text-slate-500">
            What front desk sees as bookable, every week.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DAYS.map(({ index, label }) => {
              const windows = windowsForDate(dayDates.get(index)!, availability);
              return (
                <li
                  key={index}
                  className={cn(
                    "flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm",
                    windows.length > 0 ? "border-slate-200" : "border-slate-200",
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      windows.length > 0 ? "text-slate-700" : "text-slate-400",
                    )}
                  >
                    {label}
                  </span>
                  {windows.length > 0 ? (
                    <span className="text-xs font-medium text-teal-700">
                      {windows.map((w) => `${w.startTime}–${w.endTime}`).join(", ")}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Not working</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
