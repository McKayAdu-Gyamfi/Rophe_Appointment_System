"use client";

import Link from "next/link";
import { AlertCircle, Loader2, Send } from "lucide-react";
import type { Appointment, Patient } from "@/lib/types";
import { CHANNEL_STYLES } from "@/lib/status-styles";
import { fmtDate } from "@/lib/format";
import { Panel, PanelHeader, PanelLink, EmptyNote } from "./panel";

// Occupies the reference's "Reports" slot — same shape (round icon, two lines
// of text, a trailing action per row), but the rows are the clinic's actual
// worklist: missed visits with no follow-up message sent yet.
export function FollowUpsPanel({
  appointments,
  patients,
  canAct,
  sendingId,
  onSend,
}: {
  appointments: Appointment[];
  patients: Map<string, Patient>;
  /** Only front-desk staff send messages; doctors see the list read-only. */
  canAct: boolean;
  sendingId: string | null;
  onSend: (appointment: Appointment) => void;
}) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Pending follow-ups"
        action={<PanelLink href="/messages">Message log</PanelLink>}
      />

      {appointments.length === 0 ? (
        <EmptyNote>Every missed visit has been followed up.</EmptyNote>
      ) : (
        <ul className="mt-1 divide-y divide-slate-200">
          {appointments.map((appt) => {
            const patient = patients.get(appt.patientId);
            const sending = sendingId === appt.id;
            return (
              <li key={appt.id} className="flex items-start gap-3 py-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <AlertCircle className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/patients/${appt.patientId}`}
                    className="block truncate text-[13px] font-bold text-slate-900 transition hover:text-teal-700"
                  >
                    {patient?.fullName ?? "Unknown patient"}
                  </Link>
                  <p className="truncate text-[11px] text-slate-500">
                    Missed {fmtDate(appt.date)} · {appt.appointmentType}
                  </p>
                  {patient && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {CHANNEL_STYLES[patient.preferredChannel].label} · {patient.phone}
                    </p>
                  )}
                </div>

                {canAct && (
                  <button
                    type="button"
                    onClick={() => onSend(appt)}
                    disabled={sending}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-teal-100 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Send
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
