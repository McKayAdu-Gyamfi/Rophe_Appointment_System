"use client";

import { useMemo, useState } from "react";
import type { Appointment } from "@/lib/types";
import { dateKey, startOfWeek } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import { Panel, PanelHeader, SelectPill } from "./panel";

// Sits where the reference puts "Revenue". A clinic dashboard has no revenue
// to report, and the equivalent question — is attendance holding up? — is the
// one the follow-up workflow exists to answer, so this charts attended vs.
// missed visits week by week.

const RANGES = ["Last 6 weeks", "Last 12 weeks"] as const;
type Range = (typeof RANGES)[number];

const VIEW_W = 640;
const VIEW_H = 200;
const PAD_TOP = 18;
const PAD_BOTTOM = 8;

interface WeekPoint {
  label: string;
  fullLabel: string;
  attended: number;
  missed: number;
}

/**
 * Catmull-Rom through the points, emitted as cubic beziers. Control points are
 * clamped to the plot band: an unclamped spline overshoots a steep run and the
 * curve leaves the chart area entirely.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  const clampY = (y: number) => Math.min(VIEW_H - PAD_BOTTOM, Math.max(PAD_TOP, y));
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: clampY(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: clampY(p2.y - (p3.y - p1.y) / 6) };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function AttendanceTrend({ appointments }: { appointments: Appointment[] }) {
  const [range, setRange] = useState<Range>("Last 6 weeks");
  const [hovered, setHovered] = useState<number | null>(null);

  const weeks = useMemo<WeekPoint[]>(() => {
    const count = range === "Last 6 weeks" ? 6 : 12;
    const thisWeek = startOfWeek(new Date());

    return Array.from({ length: count }, (_, i) => {
      const start = addDays(thisWeek, (i - (count - 1)) * 7);
      const keys = new Set(Array.from({ length: 7 }, (_, d) => dateKey(addDays(start, d))));

      let attended = 0;
      let missed = 0;
      for (const appt of appointments) {
        if (!keys.has(appt.date)) continue;
        if (appt.status === "attended") attended += 1;
        else if (appt.status === "missed") missed += 1;
      }

      return {
        label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        fullLabel: `Week of ${start.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
        })}`,
        attended,
        missed,
      };
    });
  }, [appointments, range]);

  const max = Math.max(1, ...weeks.map((w) => Math.max(w.attended, w.missed)));
  const step = weeks.length > 1 ? VIEW_W / (weeks.length - 1) : 0;
  const yOf = (v: number) =>
    VIEW_H - PAD_BOTTOM - (v / max) * (VIEW_H - PAD_TOP - PAD_BOTTOM);

  const attendedPts = weeks.map((w, i) => ({ x: i * step, y: yOf(w.attended) }));
  const missedPts = weeks.map((w, i) => ({ x: i * step, y: yOf(w.missed) }));
  const attendedPath = smoothPath(attendedPts);
  const areaPath = attendedPath
    ? `${attendedPath} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`
    : "";

  const totalAttended = weeks.reduce((s, w) => s + w.attended, 0);
  const totalMissed = weeks.reduce((s, w) => s + w.missed, 0);
  const rate =
    totalAttended + totalMissed === 0
      ? null
      : Math.round((totalAttended / (totalAttended + totalMissed)) * 100);

  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) =>
    Math.round((max / ticks) * (ticks - i)),
  );

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Attendance trend"
        action={
          <SelectPill
            label="Trend range"
            value={range}
            onChange={(v) => setRange(v as Range)}
            options={RANGES}
          />
        }
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-slate-500">Attendance rate</p>
          <p className="tnum mt-0.5 text-2xl font-bold leading-none text-teal-600">
            {rate === null ? "—" : `${rate}%`}
          </p>
        </div>
        <ul className="flex items-center gap-4">
          <li className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            Attended
          </li>
          <li className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-teal-900" />
            Missed
          </li>
        </ul>
      </div>

      <div className="mt-5 flex gap-3">
        {/* Padded to the same band the series are drawn in, so each tick
            label lines up with the value it names. */}
        <ul
          className="tnum flex h-[200px] w-6 flex-col justify-between text-right text-[11px] text-slate-400"
          style={{ paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM }}
        >
          {tickValues.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>

        <div className="min-w-0 flex-1">
          <div
            className="relative h-[200px] overflow-hidden"
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - box.left) / box.width;
              const i = Math.round(ratio * (weeks.length - 1));
              setHovered(Math.min(weeks.length - 1, Math.max(0, i)));
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 flex flex-col justify-between"
              style={{ paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM }}
            >
              {tickValues.map((_, i) => (
                <span key={i} className="h-px w-full bg-slate-200" />
              ))}
            </div>

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`Attended and missed visits over the ${range.toLowerCase()}`}
            >
              <defs>
                <linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#479aa8" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#479aa8" stopOpacity="0" />
                </linearGradient>
              </defs>

              {areaPath && <path d={areaPath} fill="url(#attendance-fill)" />}
              {/* Non-scaling strokes keep line weight even, since the viewBox
                  is stretched horizontally to fill the panel. */}
              <path
                d={attendedPath}
                fill="none"
                stroke="#479aa8"
                strokeWidth={2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={smoothPath(missedPts)}
                fill="none"
                stroke="#1f4a51"
                strokeWidth={2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {hovered !== null && (
                <>
                  <line
                    x1={attendedPts[hovered].x}
                    y1={0}
                    x2={attendedPts[hovered].x}
                    y2={VIEW_H}
                    stroke="#a1a1a8"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={attendedPts[hovered].x}
                    cy={attendedPts[hovered].y}
                    r={4}
                    fill="#479aa8"
                    stroke="#ffffff"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>

            {hovered !== null && (
              <div
                className="pointer-events-none absolute top-2 z-10 w-max -translate-x-1/2 rounded-lg bg-white px-3 py-2 shadow-pop"
                style={{
                  left: `${weeks.length > 1 ? (hovered / (weeks.length - 1)) * 100 : 50}%`,
                }}
              >
                <p className="text-[11px] font-semibold text-slate-900">
                  {weeks[hovered].fullLabel}
                </p>
                <p className="tnum mt-1 flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    Attended
                    <span className="font-semibold text-slate-900">
                      {weeks[hovered].attended}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-900" />
                    Missed
                    <span className="font-semibold text-slate-900">{weeks[hovered].missed}</span>
                  </span>
                </p>
              </div>
            )}
          </div>

          <ul className="mt-2 flex justify-between text-[11px] font-medium text-slate-500">
            {weeks.map((w) => (
              <li key={w.label}>{w.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
