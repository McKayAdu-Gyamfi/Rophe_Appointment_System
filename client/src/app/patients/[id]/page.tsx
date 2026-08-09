"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Cake,
  Eye,
  Mail,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { getAppointments, getPatient } from "@/lib/api";
import type { Appointment, Patient } from "@/lib/types";
import { APPOINTMENT_STATUS_STYLES, CHANNEL_STYLES } from "@/lib/status-styles";
import { age, fmtDate, fmtLongDate, fmtTime, initials, startOfDay } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useRole();
  const canEdit = role === "front-desk";

  const [patient, setPatient] = useState<Patient | undefined>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, appts] = await Promise.all([getPatient(id), getAppointments()]);
      if (!active) return;
      setPatient(p);
      setAppointments(appts.filter((a) => a.patientId === id));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const { upcoming, history } = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const isUpcoming = (a: Appointment) =>
      startOfDay(new Date(a.date)).getTime() >= today &&
      (a.status === "booked" || a.status === "confirmed" || a.status === "rescheduled");

    return {
      upcoming: appointments
        .filter(isUpcoming)
        .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))),
      history: appointments
        .filter((a) => !isUpcoming(a))
        .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date))),
    };
  }, [appointments]);

  const stats = useMemo(
    () => ({
      total: appointments.length,
      attended: appointments.filter((a) => a.status === "attended").length,
      missed: appointments.filter((a) => a.status === "missed").length,
      upcoming: upcoming.length,
    }),
    [appointments, upcoming],
  );

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-40 rounded-xl bg-slate-200" />
          <div className="h-72 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <UserRound className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Patient not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            No patient matches the id <span className="font-mono text-slate-600">{id}</span>.
          </p>
          <Link
            href="/patients"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patients
          </Link>
        </div>
      </div>
    );
  }

  const channelStyle = CHANNEL_STYLES[patient.preferredChannel];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Doctors reach this page from their schedule, not the patients list —
            send them back where they came from. */}
        <Link
          href={canEdit ? "/patients" : "/doctor/schedule"}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {canEdit ? "Patients" : "My schedule"}
        </Link>

        {/* Identity header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-lg font-semibold text-teal-700">
              {initials(patient.fullName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">{patient.fullName}</h1>
                {!canEdit && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    <Eye className="h-3 w-3" />
                    Read-only
                  </span>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                <span>{age(patient.dateOfBirth)} years old</span>
                <span className="text-slate-300">·</span>
                <span>Registered {fmtLongDate(patient.registeredDate)}</span>
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/patients/${patient.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
              <Link
                href={`/appointments/book?patientId=${patient.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
              >
                <CalendarPlus className="h-4 w-4" />
                Book appointment
              </Link>
            </div>
          )}
        </div>

        {/* Visit stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Total appointments" value={stats.total} />
          <Stat label="Attended" value={stats.attended} tone="teal" />
          <Stat label="Missed" value={stats.missed} tone="rose" />
          <Stat label="Upcoming" value={stats.upcoming} tone="amber" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Contact details */}
          <section className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Contact details</h2>
            </div>
            <dl className="divide-y divide-slate-100">
              <Field icon={<Phone className="h-4 w-4" />} label="Phone" value={patient.phone} />
              <Field
                icon={<MessageCircle className="h-4 w-4" />}
                label="WhatsApp"
                value={patient.whatsappNumber}
              />
              <Field icon={<Mail className="h-4 w-4" />} label="Email" value={patient.email} />
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 text-slate-400">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium text-slate-500">Preferred channel</dt>
                  <dd className="mt-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        channelStyle.badge,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", channelStyle.dot)} />
                      {channelStyle.label}
                    </span>
                  </dd>
                </div>
              </div>
              <Field
                icon={<Cake className="h-4 w-4" />}
                label="Date of birth"
                value={fmtLongDate(patient.dateOfBirth)}
              />
              <Field
                icon={<NotebookPen className="h-4 w-4" />}
                label="Notes"
                value={patient.notes}
              />
            </dl>
          </section>

          {/* Appointments */}
          <div className="space-y-6">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Upcoming appointments</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {upcoming.length}
                </span>
              </div>
              {upcoming.length === 0 ? (
                <p className="px-4 py-8 text-sm text-slate-400">No upcoming appointments.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((a) => (
                    <li key={a.id}>
                      <AppointmentRow appt={a} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Visit history</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {history.length}
                </span>
              </div>
              {history.length === 0 ? (
                <p className="px-4 py-8 text-sm text-slate-400">
                  No past visits recorded for this patient yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {history.map((a) => (
                    <li key={a.id}>
                      <AppointmentRow appt={a} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- sub-components -------------------------------------------------------

const STAT_TONES = {
  slate: "text-slate-900",
  teal: "text-teal-600",
  rose: "text-rose-600",
  amber: "text-amber-600",
} as const;

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className={cn("text-2xl font-semibold", STAT_TONES[tone])}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd
          className={cn(
            "mt-0.5 break-words text-sm",
            value ? "text-slate-900" : "text-slate-300",
          )}
        >
          {value || "Not provided"}
        </dd>
      </div>
    </div>
  );
}

function AppointmentRow({ appt }: { appt: Appointment }) {
  const style = APPOINTMENT_STATUS_STYLES[appt.status];
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex w-24 shrink-0 flex-col">
        <span className="text-sm font-semibold text-slate-900">{fmtDate(appt.date)}</span>
        <span className="text-[11px] text-slate-400">{fmtTime(appt.time)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{appt.appointmentType}</p>
        <p className="truncate text-xs text-slate-500">
          {appt.durationMinutes} min
          {appt.notes ? ` · ${appt.notes}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          style.badge,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
        {style.label}
      </span>
    </div>
  );
}
