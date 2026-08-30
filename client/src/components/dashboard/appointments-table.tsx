"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, MoreHorizontal } from "lucide-react";
import type { Appointment, Doctor, Patient } from "@/lib/types";
import { APPOINTMENT_STATUS_STYLES } from "@/lib/status-styles";
import { dateKey, endOfWeek, fmtDate, fmtTime } from "@/lib/format";
import { toMinutes } from "@/lib/schedule";
import { Panel, PanelHeader, SelectPill, EmptyNote, Pill } from "./panel";
import { cn } from "@/lib/utils";

// The reference's "Patient Appointment" table: a tinted, rounded header strip
// over hairline-separated rows, with two-line cells wherever an identifier
// belongs under a name. The reference's row checkboxes are left out — there is
// no bulk action behind them here, and an inert control is worse than none.

const RANGES = ["All upcoming", "This Week", "Today"] as const;
type Range = (typeof RANGES)[number];

type SortKey = "patient" | "when" | "status";

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "patient", label: "Patient" },
  { key: null, label: "Doctor", className: "hidden md:table-cell" },
  { key: null, label: "Type", className: "hidden lg:table-cell" },
  { key: "when", label: "Date & Time" },
  { key: "status", label: "Status" },
];

export function AppointmentsTable({
  appointments,
  patients,
  doctors,
  onSelect,
}: {
  appointments: Appointment[];
  patients: Map<string, Patient>;
  doctors: Map<string, Doctor>;
  onSelect: (appointment: Appointment) => void;
}) {
  const [range, setRange] = useState<Range>("All upcoming");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "when", asc: true });

  const rows = useMemo(() => {
    const todayKey = dateKey(new Date());
    const weekEndKey = dateKey(endOfWeek(new Date()));

    const inRange = appointments.filter((a) => {
      if (range === "Today") return a.date === todayKey;
      if (range === "This Week") return a.date >= todayKey && a.date <= weekEndKey;
      return a.date >= todayKey;
    });

    const direction = sort.asc ? 1 : -1;
    return [...inRange].sort((a, b) => {
      if (sort.key === "patient") {
        const an = patients.get(a.patientId)?.fullName ?? "";
        const bn = patients.get(b.patientId)?.fullName ?? "";
        return an.localeCompare(bn) * direction;
      }
      if (sort.key === "status") {
        return a.status.localeCompare(b.status) * direction;
      }
      return (
        (a.date === b.date
          ? toMinutes(a.time) - toMinutes(b.time)
          : a.date.localeCompare(b.date)) * direction
      );
    });
  }, [appointments, patients, range, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  }

  return (
    <Panel>
      <PanelHeader
        title="Patient appointments"
        action={
          <SelectPill
            label="Appointment range"
            value={range}
            onChange={(v) => setRange(v as Range)}
            options={RANGES}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyNote>No appointments in this range.</EmptyNote>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 [&>th:first-child]:rounded-l-lg [&>th:last-child]:rounded-r-lg">
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    scope="col"
                    aria-sort={
                      col.key && sort.key === col.key
                        ? sort.asc
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "px-3 py-3 text-xs font-semibold text-slate-500",
                      col.className,
                    )}
                  >
                    {col.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key as SortKey)}
                        className="inline-flex items-center gap-1 transition hover:text-slate-900"
                      >
                        {col.label}
                        <ChevronsUpDown
                          className={cn(
                            "h-3 w-3",
                            sort.key === col.key ? "text-teal-700" : "text-slate-400",
                          )}
                        />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
                <th scope="col" className="w-10 rounded-r-lg px-3 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {rows.map((appt) => {
                const patient = patients.get(appt.patientId);
                const doctor = doctors.get(appt.doctorId);
                const style = APPOINTMENT_STATUS_STYLES[appt.status];

                return (
                  <tr
                    key={appt.id}
                    onClick={() => onSelect(appt)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-3 py-3.5">
                      <span className="block truncate text-[13px] font-bold text-slate-900">
                        {patient?.fullName ?? "Unknown patient"}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {appt.patientId.toUpperCase()}
                      </span>
                    </td>

                    <td className="hidden px-3 py-3.5 md:table-cell">
                      <span className="block truncate text-[13px] font-medium text-slate-900">
                        {doctor?.fullName ?? "—"}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {doctor?.specialty ?? ""}
                      </span>
                    </td>

                    <td className="hidden px-3 py-3.5 text-[13px] text-slate-600 lg:table-cell">
                      {appt.appointmentType}
                    </td>

                    <td className="px-3 py-3.5">
                      <span className="block truncate text-[13px] font-medium text-slate-900">
                        {fmtDate(appt.date)}
                      </span>
                      <span className="tnum block truncate text-[11px] text-slate-500">
                        {fmtTime(appt.time)} · {appt.durationMinutes} min
                      </span>
                    </td>

                    <td className="px-3 py-3.5">
                      <Pill className={style.badge}>{style.label}</Pill>
                    </td>

                    <td className="px-3 py-3.5 text-right">
                      <Link
                        href={`/appointments/${appt.id}/reschedule`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Edit or reschedule ${patient?.fullName ?? "this appointment"}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
