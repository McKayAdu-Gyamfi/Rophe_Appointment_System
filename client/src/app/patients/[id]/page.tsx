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
  CalendarCheck,
  CheckCircle2,
  XCircle,
  UserRoundSearch,
  Clock3,
} from "lucide-react";
import { getAppointments, getPatient, getPatientVisitSummary } from "@/lib/api";
import type { Appointment, Patient } from "@/lib/types";
import {
  APPOINTMENT_STATUS_STYLES,
  CHANNEL_STYLES,
  RECALL_STATE_STYLES,
} from "@/lib/status-styles";
import {
  RECALL_MONTHS,
  elapsedLabel,
  reasonLabel,
  type PatientVisitSummary,
} from "@/lib/visits";
import { FIRST_VISIT_MINUTES } from "@/lib/appointment-types";
import { age, fmtDate, fmtLongDate, fmtTime, initials, startOfDay } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useRole();
  const canEdit = role === "front-desk";

  const [patient, setPatient] = useState<Patient | undefined>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [summary, setSummary] = useState<PatientVisitSummary | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, appts, visitSummary] = await Promise.all([
        getPatient(id),
        getAppointments(),
        getPatientVisitSummary(id),
      ]);
      if (!active) return;
      setPatient(p);
      setAppointments(appts.filter((a) => a.patientId === id));
      setSummary(visitSummary);
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
        <div className="mx-auto max-w-5xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
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
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
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
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-surface bg-slate-100 p-4 sm:p-5">
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
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-lg font-semibold text-teal-700">
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
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
              <Link
                href={`/appointments/book?patientId=${patient.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <CalendarPlus className="h-4 w-4" />
                Book appointment
              </Link>
            </div>
          )}
        </div>

        {summary && <VisitStatusBanner summary={summary} canEdit={canEdit} patientId={patient.id} />}

        {/* Visit stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Last seen"
            value={
              summary?.lastVisit ? elapsedLabel(summary.monthsSinceAnchor) : "Never"
            }
            icon={Clock3}
            tone={summary?.state === "lapsed" ? "alert" : "accent"}
            note={
              summary?.lastVisit
                ? fmtLongDate(summary.lastVisit.date)
                : stats.total === 0
                  ? "Registered, never booked"
                  : "Booked before, never attended"
            }
          />
          <StatCard
            label="Attended"
            value={String(stats.attended)}
            icon={CheckCircle2}
            note={
              stats.attended + stats.missed === 0
                ? "No completed visits yet"
                : `${Math.round((stats.attended / (stats.attended + stats.missed)) * 100)}% turn-up rate`
            }
          />
          <StatCard
            label="Missed"
            value={String(stats.missed)}
            icon={XCircle}
            tone={stats.missed > 0 ? "alert" : "accent"}
            note={stats.missed === 0 ? "Never missed a visit" : "Worth a follow-up call"}
          />
          <StatCard
            label="Upcoming"
            value={String(stats.upcoming)}
            icon={CalendarCheck}
            note={stats.upcoming === 0 ? "Nothing booked" : "Already on the calendar"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Contact details */}
          <section className="h-fit overflow-hidden rounded-panel bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Contact details</h2>
            </div>
            <dl className="divide-y divide-slate-200">
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
            <section className="overflow-hidden rounded-panel bg-white">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Upcoming appointments</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {upcoming.length}
                </span>
              </div>
              {upcoming.length === 0 ? (
                <p className="px-4 py-8 text-sm text-slate-400">No upcoming appointments.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {upcoming.map((a) => (
                    <li key={a.id}>
                      <AppointmentRow appt={a} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="overflow-hidden rounded-panel bg-white">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
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
                <ul className="divide-y divide-slate-200">
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

/**
 * Where this patient stands against the clinic's six-month rule.
 *
 * Only shown when it changes what staff should do — a patient seen last month
 * needs no banner, and one who is simply due back is already covered by the
 * "Last seen" tile. The three cases worth interrupting for are: they are
 * overdue, they are about to be, or the visit on the calendar is their first
 * and therefore needs the long slot.
 */
function VisitStatusBanner({
  summary,
  canEdit,
  patientId,
}: {
  summary: PatientVisitSummary;
  canEdit: boolean;
  patientId: string;
}) {
  const style = RECALL_STATE_STYLES[summary.state];

  if (summary.state === "lapsed" || summary.state === "lapsing") {
    const overdue = summary.state === "lapsed";
    return (
      <div
        className={cn(
          "mb-6 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3",
          overdue ? "bg-rose-50" : "bg-amber-50",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            overdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800",
          )}
        >
          <UserRoundSearch className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold",
              overdue ? "text-rose-900" : "text-amber-900",
            )}
          >
            {overdue
              ? `Not seen for ${RECALL_MONTHS} months or more`
              : "Approaching the six-month mark"}
            {summary.recentlyContacted && " — recall already sent"}
          </p>
          <p className={cn("text-xs", overdue ? "text-rose-700" : "text-amber-800")}>
            {reasonLabel(summary)} · last seen {elapsedLabel(summary.monthsSinceAnchor)}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Link
              href="/recalls"
              className="rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Recall list
            </Link>
            <Link
              href={`/appointments/book?patientId=${patientId}`}
              className="rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
            >
              Book them in
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Booked in, but never actually seen — the appointment needs the long slot.
  if (summary.isFirstVisit && summary.nextAppointment) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-teal-50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800">
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-teal-900">
            First visit — {FIRST_VISIT_MINUTES} minutes
          </p>
          <p className="text-xs text-teal-700">
            The clinic has not seen this patient before, so their appointment on{" "}
            {fmtDate(summary.nextAppointment.date)} is booked at the new-patient length.
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

  return null;
}
