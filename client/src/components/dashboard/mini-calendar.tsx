"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Appointment } from "@/lib/types";
import { dateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

// Month strip from the reference's right rail. Days carrying appointments get
// a soft tint; today is filled. Picking a day filters the agenda below it.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MiniCalendar({
  appointments,
  selected,
  onSelect,
}: {
  appointments: Appointment[];
  /** "YYYY-MM-DD", or null when the agenda is showing the whole week. */
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const todayKey = dateKey(today);

  const busyDays = useMemo(() => {
    const set = new Set<string>();
    for (const a of appointments) {
      if (a.status !== "cancelled") set.add(a.date);
    }
    return set;
  }, [appointments]);

  // Six rows of seven, starting on the Sunday on or before the 1st, so the
  // grid height never changes as the user pages through months.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return {
        date,
        key: dateKey(date),
        day: date.getDate(),
        inMonth: date.getMonth() === month.getMonth(),
      };
    });
  }, [month]);

  function shiftMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <section className="rounded-panel bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">
          {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[11px] font-semibold text-slate-500">
            {d}
          </span>
        ))}

        {cells.map((cell) => {
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selected;
          const busy = busyDays.has(cell.key);

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(isSelected ? null : cell.key)}
              aria-pressed={isSelected}
              aria-label={cell.date.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              className="flex justify-center py-0.5"
            >
              <span
                className={cn(
                  "tnum flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition",
                  !cell.inMonth && "text-slate-300",
                  cell.inMonth && "text-slate-700 hover:bg-slate-100",
                  busy && cell.inMonth && !isToday && "bg-teal-100 font-semibold text-teal-900",
                  isToday && "bg-teal-700 font-bold text-white hover:bg-teal-800",
                  isSelected && !isToday && "ring-2 ring-teal-600",
                )}
              >
                {cell.day}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
