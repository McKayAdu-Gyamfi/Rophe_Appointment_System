"use client";

import type { Appointment, Patient } from "@/lib/types";
import { fmtTime } from "@/lib/format";
import { APPOINTMENT_STATUS_STYLES } from "@/lib/status-styles";
import { Panel, PanelHeader, PanelMenuLink, EmptyNote, Pill } from "./panel";
import { cn } from "@/lib/utils";

// The reference's "Agenda": a date chip on the left, a type badge and title on
// the right, all on a tinted card. Ours lists the visits still to come.
export function AgendaPanel({
  title,
  appointments,
  patients,
  onSelect,
}: {
  title: string;
  appointments: Appointment[];
  patients: Map<string, Patient>;
  onSelect: (appointment: Appointment) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title={title}
        action={<PanelMenuLink href="/appointments" label="Open the appointments calendar" />}
      />

      {appointments.length === 0 ? (
        <EmptyNote>Nothing else booked in this range.</EmptyNote>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {appointments.map((appt, i) => {
            const date = new Date(appt.date);
            const style = APPOINTMENT_STATUS_STYLES[appt.status];
            // The next visit up is the one staff are actually preparing for,
            // so it takes the filled chip and the rest take outline chips.
            const isNext = i === 0;

            return (
              <li key={appt.id}>
                <button
                  type="button"
                  onClick={() => onSelect(appt)}
                  className="flex w-full items-center gap-3 rounded-panel bg-teal-100 p-3 text-left transition hover:bg-teal-200"
                >
                  <span className="flex w-9 shrink-0 flex-col items-center">
                    <span className="tnum text-lg font-bold leading-none text-teal-900">
                      {date.getDate()}
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                      {date.toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <Pill
                      className={cn(
                        isNext ? "bg-teal-900 text-white" : "bg-white text-teal-800",
                      )}
                    >
                      {style.label}
                    </Pill>
                    <span className="mt-1 block truncate text-[13px] font-bold text-slate-900">
                      {patients.get(appt.patientId)?.fullName ?? "Unknown patient"}
                    </span>
                    <span className="tnum block truncate text-[11px] text-teal-800">
                      {fmtTime(appt.time)} · {appt.appointmentType}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
