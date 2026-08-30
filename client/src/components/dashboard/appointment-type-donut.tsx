"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/types";
import { Panel, PanelHeader, PanelMenuLink, EmptyNote } from "./panel";

// The reference's "Patient by Departments" donut. The clinic has a single
// specialist rather than departments, so the equivalent breakdown is what the
// visits are *for* — the mix front-desk staff schedule around.

const SEGMENT_COLORS = [
  "#1f4a51", // teal-900
  "#479aa8", // teal-600
  "#98cdd5", // teal-300
  "#cdcdd1", // slate-300
  "#def1ef", // teal-100
  "#e2e2e4", // slate-200
];

const SIZE = 208;
const CENTER = SIZE / 2;
const RADIUS = 68;
const THICKNESS = 26;
/** Degrees of blank ring between slices, as in the reference. */
const GAP = 3;

function polar(angleDeg: number, radius: number) {
  // -90 puts the first slice at twelve o'clock.
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number): string {
  const start = polar(startDeg, RADIUS);
  const end = polar(endDeg, RADIUS);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function AppointmentTypeDonut({ appointments }: { appointments: Appointment[] }) {
  const { slices, total } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appt of appointments) {
      if (appt.status === "cancelled") continue;
      counts.set(appt.appointmentType, (counts.get(appt.appointmentType) ?? 0) + 1);
    }

    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const sum = entries.reduce((acc, [, n]) => acc + n, 0);

    // Walked with a plain loop rather than map(): each slice's start angle is
    // the running total of the ones before it.
    const slices: {
      label: string;
      value: number;
      percent: number;
      color: string;
      start: number;
      end: number;
    }[] = [];

    let cursor = 0;
    for (const [i, [label, value]] of entries.entries()) {
      const sweep = sum === 0 ? 0 : (value / sum) * 360;
      slices.push({
        label,
        value,
        percent: sum === 0 ? 0 : Math.round((value / sum) * 100),
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        start: cursor,
        end: cursor + sweep,
      });
      cursor += sweep;
    }

    return { slices, total: sum };
  }, [appointments]);

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Appointments by type"
        action={<PanelMenuLink href="/appointments" label="Open the appointments calendar" />}
      />

      {total === 0 ? (
        <EmptyNote>No appointments on the books yet.</EmptyNote>
      ) : (
        <>
          <div className="mt-2 flex justify-center">
            <div className="relative">
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                role="img"
                aria-label={`Appointments by type: ${slices
                  .map((s) => `${s.label} ${s.value}`)
                  .join(", ")}`}
              >
                {slices.map((s) => {
                  // A single slice covering the whole ring has no gap to draw
                  // and would collapse to a zero-length arc, so it renders as
                  // a plain circle instead.
                  if (s.end - s.start >= 359.9) {
                    return (
                      <circle
                        key={s.label}
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={THICKNESS}
                      />
                    );
                  }
                  const half = Math.min(GAP / 2, (s.end - s.start) / 3);
                  return (
                    <path
                      key={s.label}
                      d={arcPath(s.start + half, s.end - half)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={THICKNESS}
                      strokeLinecap="round"
                    />
                  );
                })}

                {slices
                  .filter((s) => s.percent >= 6)
                  .map((s) => {
                    const mid = (s.start + s.end) / 2;
                    const at = polar(mid, RADIUS + THICKNESS / 2 + 12);
                    return (
                      <text
                        key={s.label}
                        x={at.x}
                        y={at.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-slate-500 text-[10px] font-semibold"
                      >
                        {s.percent}%
                      </text>
                    );
                  })}
              </svg>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-medium text-slate-500">All visits</span>
                <span className="tnum text-2xl font-bold leading-tight text-teal-900">
                  {total}
                </span>
              </div>
            </div>
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {slices.map((s) => (
              <li key={s.label} className="flex items-start gap-2">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: s.color }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-900">
                    {s.label}
                  </span>
                  <span className="tnum block text-[11px] text-slate-500">
                    {s.value} {s.value === 1 ? "visit" : "visits"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
