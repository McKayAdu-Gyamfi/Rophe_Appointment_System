"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, TrendingUp, UserRoundSearch, XCircle } from "lucide-react";
import {
  getAppointments,
  getDoctors,
  getMessages,
  getPatients,
  sendMessage,
  getDoctorAvailability,
  getAppointmentTypes,
  getClinicSettings,
} from "@/lib/api";
import type { Appointment, Doctor, DoctorAvailability, Message, Patient, ScheduleConfig } from "@/lib/types";
import { CHANNEL_STYLES } from "@/lib/status-styles";
import { dateKey, fmtDate, startOfWeek, endOfWeek } from "@/lib/format";
import { toMinutes } from "@/lib/schedule";
import { AppointmentDetailDialog } from "@/components/appointment-detail-dialog";
import { useRole } from "@/lib/role-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { WeeklyAppointmentsChart } from "@/components/dashboard/weekly-appointments-chart";
import { AppointmentTypeDonut } from "@/components/dashboard/appointment-type-donut";
import { AttendanceTrend } from "@/components/dashboard/attendance-trend";
import { FollowUpsPanel } from "@/components/dashboard/follow-ups-panel";
import { AppointmentsTable } from "@/components/dashboard/appointments-table";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { ClinicSchedulePanel } from "@/components/dashboard/clinic-schedule-panel";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { RecallPanel } from "@/components/dashboard/recall-panel";
import { buildVisitSummaries, needsRecall, RECALL_MONTHS } from "@/lib/visits";

// ---------------------------------------------------------------------------
// Front-desk dashboard.
//
// Structure follows the Medlink admin reference: a recessed surface holding
// the analytics and the appointment table, with a fixed right rail for the
// calendar, agenda, schedule and activity feed. The page title lives in the
// top bar (see PAGE_META in lib/nav.ts), so there is no <h1> here.
// ---------------------------------------------------------------------------

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
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  /** Day picked in the rail's calendar; null means "the rest of this week". */
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [appts, pts, msgs, docs, avail, types, settings] = await Promise.all([
        getAppointments(),
        getPatients(),
        getMessages(),
        getDoctors(),
        getDoctorAvailability(),
        getAppointmentTypes(),
        getClinicSettings(),
      ]);
      if (!active) return;
      setAppointments(appts);
      setPatients(pts);
      setMessages(msgs);
      setDoctors(docs);
      setAvailability(avail);
      setConfig({ clinicSettings: settings, appointmentTypes: types.filter((t) => t.isActive) });
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

  const doctorMap = useMemo(() => {
    const m = new Map<string, Doctor>();
    doctors.forEach((d) => m.set(d.id, d));
    return m;
  }, [doctors]);

  // Dates compare as "YYYY-MM-DD" strings — same convention as the calendar,
  // and immune to the UTC-shift that trips up Date arithmetic.
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const weekStartKey = useMemo(() => dateKey(startOfWeek(new Date())), []);
  const weekEndKey = useMemo(() => dateKey(endOfWeek(new Date())), []);

  const todays = useMemo(
    () =>
      appointments
        .filter((a) => a.date === todayKey)
        .sort((a, b) => toMinutes(a.time) - toMinutes(b.time)),
    [appointments, todayKey],
  );

  const missedVisits = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "missed")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [appointments],
  );

  // Attendance rate: attended / (attended + missed) this week.
  const weekOutcomes = useMemo(() => {
    const inWeek = appointments.filter((a) => a.date >= weekStartKey && a.date <= weekEndKey);
    const attended = inWeek.filter((a) => a.status === "attended").length;
    const missed = inWeek.filter((a) => a.status === "missed").length;
    const denom = attended + missed;
    return { attended, missed, rate: denom === 0 ? null : Math.round((attended / denom) * 100) };
  }, [appointments, weekStartKey, weekEndKey]);

  const bookedToday = useMemo(
    () => todays.filter((a) => a.status === "booked").length,
    [todays],
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

  // The six-month tail (lib/visits.ts). Computed here from data the dashboard
  // already holds rather than fetched separately — the recall screen calls
  // getPatientRecalls() for the same join when it needs the full list.
  const dueForRecall = useMemo(() => {
    const summaries = buildVisitSummaries(patients, appointments, messages);
    return patients
      .map((patient) => ({ patient, summary: summaries.get(patient.id)! }))
      .filter(({ summary }) => needsRecall(summary))
      .sort((a, b) => b.summary.monthsQuiet - a.summary.monthsQuiet);
  }, [patients, appointments, messages]);

  // The rail's agenda: either the day picked in the calendar, or what is still
  // to come. Late in the week the "rest of this week" window is often empty —
  // rather than show an empty card, it then reaches past the week boundary.
  const upcoming = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            a.date > todayKey &&
            (a.status === "booked" || a.status === "confirmed" || a.status === "rescheduled"),
        )
        .sort((a, b) =>
          a.date === b.date ? toMinutes(a.time) - toMinutes(b.time) : a.date.localeCompare(b.date),
        ),
    [appointments, todayKey],
  );

  const restOfWeek = useMemo(
    () => upcoming.filter((a) => a.date <= weekEndKey),
    [upcoming, weekEndKey],
  );

  const agenda = useMemo(() => {
    if (selectedDay) {
      return appointments
        .filter((a) => a.date === selectedDay)
        .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
        .slice(0, 3);
    }
    return (restOfWeek.length > 0 ? restOfWeek : upcoming).slice(0, 3);
  }, [appointments, selectedDay, restOfWeek, upcoming]);

  const agendaTitle = selectedDay
    ? selectedDay === todayKey
      ? "Today's agenda"
      : `Agenda · ${fmtDate(selectedDay)}`
    : restOfWeek.length > 0
      ? "Coming up this week"
      : "Coming up next";

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

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Recessed surface. Panels are borderless white blocks on it — the
            reference separates them by value alone, never by a stroke. */}
        <div className="min-w-0 space-y-5 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Today's appointments"
              value={String(todays.length)}
              icon={CalendarDays}
              note={
                bookedToday === 0
                  ? "All confirmed"
                  : `${bookedToday} awaiting confirmation`
              }
            />
            <StatCard
              label="Attendance rate (week)"
              value={weekOutcomes.rate === null ? "—" : `${weekOutcomes.rate}%`}
              icon={TrendingUp}
              note={`${weekOutcomes.attended} attended · ${weekOutcomes.missed} missed`}
            />
            <StatCard
              label="Missed visits"
              value={String(missedVisits.length)}
              icon={XCircle}
              tone={pendingFollowUps.length > 0 ? "alert" : "accent"}
              note={
                pendingFollowUps.length === 0
                  ? "All followed up"
                  : `${pendingFollowUps.length} awaiting follow-up`
              }
            />
            <StatCard
              label="Due for recall"
              value={String(dueForRecall.length)}
              icon={UserRoundSearch}
              tone={dueForRecall.length > 0 ? "alert" : "accent"}
              note={
                dueForRecall.length === 0
                  ? "Everyone seen recently"
                  : `Not seen in ${RECALL_MONTHS}+ months`
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <WeeklyAppointmentsChart appointments={appointments} />
            <AppointmentTypeDonut appointments={appointments} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <AttendanceTrend appointments={appointments} />
            <FollowUpsPanel
              appointments={pendingFollowUps.slice(0, 5)}
              patients={patientMap}
              canAct={canAct}
              sendingId={sendingId}
              onSend={(a) => void sendFollowUp(a)}
            />
          </div>

          {/* Missed visits are chased within days; recalls are the six-month
              tail behind them. Sitting them next to each other keeps the two
              timescales visibly distinct. */}
          <RecallPanel entries={dueForRecall} />

          <AppointmentsTable
            appointments={appointments}
            patients={patientMap}
            doctors={doctorMap}
            onSelect={setSelected}
          />
        </div>

        <div className="space-y-5">
          <MiniCalendar
            appointments={appointments}
            selected={selectedDay}
            onSelect={setSelectedDay}
          />
          <AgendaPanel
            title={agendaTitle}
            appointments={agenda}
            patients={patientMap}
            onSelect={setSelected}
          />
          {config && (
            <ClinicSchedulePanel
              doctor={doctors[0]}
              availability={availability}
              appointments={appointments}
              config={config}
            />
          )}
          <ActivityPanel messages={messages} patients={patientMap} limit={5} />
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

function DashboardSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="grid animate-pulse items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5 rounded-surface bg-slate-100 p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-panel bg-white" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="h-80 rounded-panel bg-white" />
            <div className="h-80 rounded-panel bg-white" />
          </div>
          <div className="h-72 rounded-panel bg-white" />
        </div>
        <div className="space-y-5">
          <div className="h-72 rounded-panel bg-slate-100" />
          <div className="h-56 rounded-panel bg-slate-100" />
          <div className="h-64 rounded-panel bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
