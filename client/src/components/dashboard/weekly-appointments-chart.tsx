"use client";

import { useMemo, useState } from "react";
import type { Appointment } from "@/lib/types";
import { dateKey, startOfWeek } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import { Panel, PanelHeader, SelectPill } from "./panel";
import { cn } from "@/lib/utils";

// The reference's "Patient by Age Stages" block: a total readout, a legend,
// and one grouped bar per weekday. Ours groups the week's appointments by
// outcome, which is the equivalent question for a clinic — an age split isn't
// something the front desk acts on.
//
// Built in HTML rather than SVG: the bars are flex children with percentage
// heights, so the chart reflows with the panel and the axis type stays crisp
// at every width.

const RANGES = ["This Week", "Last Week"] as const;
type Range = (typeof RANGES)[number];

const SERIES = [
  { key: "scheduled", label: "Scheduled", bar: "bg-slate-300", dot: "bg-slate-300" },
  { key: "attended", label: "Attended", bar: "bg-teal-600", dot: "bg-teal-600" },
  { key: "missed", label: "Missed", bar: "bg-rose-400", dot: "bg-rose-400" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayBucket {
  label: string;
  dateLabel: string;
  counts: Record<SeriesKey, number>;
}

/** Six appointment statuses collapse to the three outcomes staff plan around. */
function bucketOf(status: Appointment["status"]): SeriesKey | null {
  switch (status) {
    case "booked":
    case "confirmed":
    case "rescheduled":
      return "scheduled";
    case "attended":
      return "attended";
    case "missed":
      return "missed";
    case "cancelled":
      return null;
  }
}

/** Round the axis top up to whole ticks so gridlines land on integers. */
function axisTop(max: number, ticks: number): number {
  if (max <= 0) return ticks;
  return Math.ceil(max / ticks) * ticks;
}

export function WeeklyAppointmentsChart({ appointments }: { appointments: Appointment[] }) {
  const [range, setRange] = useState<Range>("This Week");
  const [hovered, setHovered] = useState<number | null>(null);

  const days = useMemo<DayBucket[]>(() => {
    const start = startOfWeek(new Date());
    if (range === "Last Week") start.setDate(start.getDate() - 7);

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const key = dateKey(date);
      const counts: Record<SeriesKey, number> = { scheduled: 0, attended: 0, missed: 0 };

      for (const appt of appointments) {
        if (appt.date !== key) continue;
        const bucket = bucketOf(appt.status);
        if (bucket) counts[bucket] += 1;
      }

      return {
        label: DAY_LABELS[i],
        dateLabel: date.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        counts,
      };
    });
  }, [appointments, range]);

  const total = useMemo(
    () =>
      days.reduce(
        (sum, d) => sum + d.counts.scheduled + d.counts.attended + d.counts.missed,
        0,
      ),
    [days],
  );

  const TICKS = 4;
  const top = axisTop(
    Math.max(...days.flatMap((d) => SERIES.map((s) => d.counts[s.key]))),
    TICKS,
  );
  const tickValues = Array.from({ length: TICKS + 1 }, (_, i) => (top / TICKS) * (TICKS - i));

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Appointments by day"
        action={
          <SelectPill
            label="Chart range"
            value={range}
            onChange={(v) => setRange(v as Range)}
            options={RANGES}
          />
        }
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-slate-500">Total appointments</p>
          <p className="tnum mt-0.5 text-2xl font-bold leading-none text-teal-600">{total}</p>
        </div>
        <ul className="flex items-center gap-4">
          {SERIES.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600"
            >
              <span className={cn("h-2 w-2 rounded-full", s.dot)} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex gap-3">
        <ul className="tnum flex h-[200px] w-6 flex-col justify-between text-right text-[11px] text-slate-400">
          {tickValues.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <div className="relative min-w-0 flex-1">
          {/* Gridlines sit behind the bars, one per axis tick. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[200px] flex-col justify-between">
            {tickValues.map((t) => (
              <span key={t} className="h-px w-full bg-slate-200" />
            ))}
          </div>

          <div className="relative flex h-[200px] items-end gap-1">
            {days.map((day, i) => {
              const dayTotal = day.counts.scheduled + day.counts.attended + day.counts.missed;
              return (
                <div
                  key={day.label}
                  className="relative flex h-full flex-1 items-end"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="flex h-full w-full items-end justify-center gap-[3px]">
                    {SERIES.map((s) => {
                      const value = day.counts[s.key];
                      return (
                        <span
                          key={s.key}
                          title={`${day.dateLabel} · ${s.label}: ${value}`}
                          style={{ height: top === 0 ? 0 : `${(value / top) * 100}%` }}
                          className={cn(
                            "min-h-[2px] w-2.5 rounded-t-[3px] transition-opacity",
                            s.bar,
                            hovered !== null && hovered !== i && "opacity-40",
                          )}
                        />
                      );
                    })}
                  </div>

                  {hovered === i && dayTotal > 0 && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg bg-white px-3 py-2 shadow-pop">
                      <p className="text-[11px] font-semibold text-slate-900">{day.dateLabel}</p>
                      <ul className="mt-1 flex items-center gap-3">
                        {SERIES.map((s) => (
                          <li
                            key={s.key}
                            className="flex items-center gap-1 text-[11px] text-slate-600"
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                            <span className="tnum font-semibold text-slate-900">
                              {day.counts[s.key]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <ul className="mt-2 flex gap-1">
            {days.map((day) => (
              <li
                key={day.label}
                className="flex-1 text-center text-[11px] font-medium text-slate-500"
              >
                {day.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
