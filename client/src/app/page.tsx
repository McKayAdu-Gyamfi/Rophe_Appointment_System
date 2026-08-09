"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  TrendingUp,
  UserRound,
  XCircle,
  ArrowRight,
  Phone,
} from "lucide-react";
import { getAppointments, getMessages, getPatients, sendMessage } from "@/lib/api";
import type { Appointment, Message, Patient } from "@/lib/types";
import { APPOINTMENT_STATUS_STYLES, CHANNEL_STYLES } from "@/lib/status-styles";
import { dateKey, fmtDate, fmtTime, startOfWeek, endOfWeek } from "@/lib/format";
import { AppointmentDetailDialog } from "@/components/appointment-detail-dialog";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

// --- component -------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAct = role === "front-desk";

  // "/" is the front-desk dashboard. A doctor arriving here directly (typed
  // URL, bookmark, restored role from localStorage) belongs on their own.
  useEffect(() => {
    if (role === "doctor") router.replace("/doctor");
  }, [role, router]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [appts, pts, msgs] = await Promise.all([
        getAppointments(),
        getPatients(),
        getMessages(),
      ]);
      if (!active) return;
      setAppointments(appts);
      setPatients(pts);
      setMessages(msgs);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const patientMap = useMemo(() => {
    const m = new Map<string, Patient>();
    patients.forEach((p) => m.set(p.id, p));
    return m;
  }, [patients]);

  const patientName = useCallback(
    (id: string) => patientMap.get(id)?.fullName ?? "Unknown patient",
    [patientMap],
  );

  // Dates compare as "YYYY-MM-DD" strings — same convention as the calendar,
  // and immune to the UTC-shift that trips up Date arithmetic.
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const weekStartKey = useMemo(() => dateKey(startOfWeek(new Date())), []);
  const weekEndKey = useMemo(() => dateKey(endOfWeek(new Date())), []);

  const todays = useMemo(
    () =>
      appointments
        .filter((a) => a.date === todayKey)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, todayKey],
  );

  const upcomingThisWeek = useMemo(
    () =>
      appointments
        .filter((a) => a.date > todayKey && a.date <= weekEndKey)
        .filter((a) => a.status === "booked" || a.status === "confirmed")
        .sort((a, b) =>
          a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
        ),
    [appointments, todayKey, weekEndKey],
  );

  const missedVisits = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "missed")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [appointments],
  );

  // Attendance rate: attended / (attended + missed) this week.
  const attendanceRate = useMemo(() => {
    const inWeek = appointments.filter((a) => a.date >= weekStartKey && a.date <= weekEndKey);
    const attended = inWeek.filter((a) => a.status === "attended").length;
    const missed = inWeek.filter((a) => a.status === "missed").length;
    const denom = attended + missed;
    return denom === 0 ? 0 : Math.round((attended / denom) * 100);
  }, [appointments, weekStartKey, weekEndKey]);

  const bookedToday = useMemo(
    () => appointments.filter((a) => a.date === todayKey && a.status === "booked").length,
    [appointments, todayKey],
  );

  // A missed visit counts as handled once a follow-up message exists for it —
  // that's what keeps this an action list rather than a copy of the one above.
  const followedUpIds = useMemo(() => {
    const ids = new Set<string>();
    messages.forEach((m) => {
      if (m.type === "follow-up" && m.appointmentId) ids.add(m.appointmentId);
    });
    return ids;
  }, [messages]);

  const pendingFollowUps = useMemo(
    () => missedVisits.filter((a) => !followedUpIds.has(a.id)),
    [missedVisits, followedUpIds],
  );

  const handleStatusChanged = useCallback((updated: Appointment) => {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...updated } : a)));
    setSelected({ ...updated });
  }, []);

  const sendFollowUp = useCallback(
    async (appointment: Appointment) => {
      const patient = patientMap.get(appointment.patientId);
      if (!patient) return;

      setSendingId(appointment.id);
      try {
        const preview = `We missed you on ${fmtDate(appointment.date)}. Please call the clinic to rebook your ${appointment.appointmentType.toLowerCase()}.`;
        const message = await sendMessage({
          patientId: patient.id,
          appointmentId: appointment.id,
          channel: patient.preferredChannel,
          type: "follow-up",
          contentPreview: preview,
        });
        setMessages((prev) => [message, ...prev]);
        toast.success(
          `Follow-up sent via ${CHANNEL_STYLES[patient.preferredChannel].label}`,
          { description: `${patient.fullName} — ${preview}` },
        );
      } catch {
        toast.error("Couldn't send that follow-up. Try again.");
      } finally {
        setSendingId(null);
      }
    },
    [patientMap],
  );

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded-lg bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-200" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-900">Front-desk Dashboard</h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Quick stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Attendance rate (this week)"
            value={`${attendanceRate}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="teal"
          />
          <StatCard
            label="Booked today"
            value={String(bookedToday)}
            icon={<CalendarDays className="h-5 w-5" />}
            accent="amber"
          />
          <StatCard
            label="Today's appointments"
            value={String(todays.length)}
            icon={<Clock className="h-5 w-5" />}
            accent="sky"
          />
          <StatCard
            label="Missed visits"
            value={String(missedVisits.length)}
            icon={<XCircle className="h-5 w-5" />}
            accent="rose"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Today's appointments */}
          <Section
            title="Today's appointments"
            count={todays.length}
            actionHref="/appointments"
            actionLabel="View all"
          >
            {todays.length === 0 ? (
              <Empty text="No appointments scheduled today." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {todays.map((a) => (
                  <li key={a.id}>
                    <AppointmentRow
                      appt={a}
                      patientName={patientName(a.patientId)}
                      onSelect={() => setSelected(a)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Upcoming this week */}
          <Section
            title="Upcoming this week"
            count={upcomingThisWeek.length}
            actionHref="/appointments"
            actionLabel="View calendar"
          >
            {upcomingThisWeek.length === 0 ? (
              <Empty text="No upcoming appointments this week." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingThisWeek.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <AppointmentRow
                      appt={a}
                      patientName={patientName(a.patientId)}
                      showDate
                      onSelect={() => setSelected(a)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Missed visits */}
          <Section
            title="Missed visits"
            count={missedVisits.length}
            actionHref="/appointments"
            actionLabel="View all"
          >
            {missedVisits.length === 0 ? (
              <Empty text="No missed visits. Great!" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {missedVisits.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <AppointmentRow
                      appt={a}
                      patientName={patientName(a.patientId)}
                      showDate
                      onSelect={() => setSelected(a)}
                      tag={followedUpIds.has(a.id) ? "Followed up" : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Pending follow-ups action list */}
          <Section
            title="Pending follow-ups"
            count={pendingFollowUps.length}
            actionHref="/messages"
            actionLabel="Message log"
          >
            {pendingFollowUps.length === 0 ? (
              <Empty
                text={
                  missedVisits.length === 0
                    ? "Nothing to follow up on."
                    : "Every missed visit has been followed up."
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingFollowUps.map((a) => {
                  const p = patientMap.get(a.patientId);
                  const sending = sendingId === a.id;
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50">
                        <UserRound className="h-4 w-4 text-rose-500" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/patients/${p?.id ?? a.patientId}`}
                          className="truncate text-sm font-medium text-slate-900 transition hover:text-teal-700"
                        >
                          {patientName(a.patientId)}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          Missed {fmtDate(a.date)} · {a.appointmentType}
                          {p && ` · ${CHANNEL_STYLES[p.preferredChannel].label}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p?.phone && (
                          <span className="hidden items-center gap-1 text-xs text-slate-400 lg:inline-flex">
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </span>
                        )}
                        {canAct && (
                          <button
                            type="button"
                            onClick={() => void sendFollowUp(a)}
                            disabled={sending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {sending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            Send follow-up
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <AppointmentDetailDialog
        appointment={selected}
        patient={selected ? patientMap.get(selected.patientId) : undefined}
        onClose={() => setSelected(null)}
        onChanged={handleStatusChanged}
      />
    </div>
  );
}

// --- sub-components -------------------------------------------------------

const ACCENTS: Record<string, { bg: string; text: string; ring: string }> = {
  teal: { bg: "bg-teal-50", text: "text-teal-600", ring: "ring-teal-100" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100" },
  sky: { bg: "bg-sky-50", text: "text-sky-600", ring: "ring-sky-100" },
  rose: { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-100" },
};

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: keyof typeof ACCENTS;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg ring-4",
            a.bg,
            a.text,
            a.ring,
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function Section({
  title,
  count,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  count: number;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {count}
          </span>
        </div>
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-700"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function AppointmentRow({
  appt,
  patientName,
  showDate,
  onSelect,
  tag,
}: {
  appt: Appointment;
  patientName: string;
  showDate?: boolean;
  /** Opens the status dialog — how staff mark an appointment missed from here. */
  onSelect: () => void;
  tag?: string;
}) {
  const style = APPOINTMENT_STATUS_STYLES[appt.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
    >
      <div className="flex w-16 shrink-0 flex-col">
        <span className="text-sm font-semibold text-slate-900">{fmtTime(appt.time)}</span>
        {showDate && (
          <span className="text-[11px] text-slate-400">{fmtDate(appt.date)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{patientName}</p>
        <p className="truncate text-xs text-slate-500">
          {appt.appointmentType}
          {tag && <span className="text-teal-600"> · {tag}</span>}
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
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-10 text-sm text-slate-400">
      <CheckCircle2 className="h-4 w-4 text-teal-400" />
      {text}
    </div>
  );
}
