"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  ChevronRight,
  Plus,
  Search,
  UserRound,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { getAppointments, getMessages, getPatients } from "@/lib/api";
import type { Appointment, Channel, Message, Patient } from "@/lib/types";
import { CHANNEL_STYLES, RECALL_STATE_STYLES } from "@/lib/status-styles";
import { RECALL_MONTHS, buildVisitSummaries, elapsedLabel, needsRecall } from "@/lib/visits";
import { age, fmtDate, initials } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";

type ChannelFilter = "all" | Channel;

const CHANNEL_FILTERS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];

/** Digits only, so "+233 24 123 4567" matches a search for "0241234567" or "24123". */
function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export default function PatientsPage() {
  const { role } = useRole();
  const canEdit = role === "front-desk";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  /** Narrows the list to the six-month recall cohort (lib/visits.ts). */
  const [lapsedOnly, setLapsedOnly] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [pts, appts, msgs] = await Promise.all([
        getPatients(),
        getAppointments(),
        getMessages(),
      ]);
      if (!active) return;
      setPatients(pts);
      setAppointments(appts);
      setMessages(msgs);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Per-patient visit summary, derived once rather than per row. Shared with
  // the recall screen and the dashboard so "last seen" means one thing.
  const summaries = useMemo(
    () => buildVisitSummaries(patients, appointments, messages),
    [patients, appointments, messages],
  );

  // Roll-up for the header tiles. "Due for recall" is the one front desk acts
  // on: six months without a visit and nothing on the calendar.
  const stats = useMemo(() => {
    let withUpcoming = 0;
    let lapsed = 0;
    for (const patient of patients) {
      const summary = summaries.get(patient.id);
      if (!summary) continue;
      if (summary.nextAppointment) withUpcoming += 1;
      if (needsRecall(summary)) lapsed += 1;
    }
    return { withUpcoming, lapsed };
  }, [patients, summaries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digits(query);

    return patients
      .filter((p) => (channel === "all" ? true : p.preferredChannel === channel))
      .filter((p) => {
        if (!lapsedOnly) return true;
        const summary = summaries.get(p.id);
        return summary ? needsRecall(summary) : false;
      })
      .filter((p) => {
        if (!q) return true;
        if (p.fullName.toLowerCase().includes(q)) return true;
        if (qDigits.length >= 2) {
          if (digits(p.phone).includes(qDigits)) return true;
          if (p.whatsappNumber && digits(p.whatsappNumber).includes(qDigits)) return true;
        }
        return p.email?.toLowerCase().includes(q) ?? false;
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [patients, query, channel, lapsedOnly, summaries]);

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-11 rounded-xl bg-slate-200" />
          <div className="h-96 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-surface bg-slate-100 p-4 sm:p-5">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div />
          {canEdit && (
            <Link
              href="/patients/new"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Add patient
            </Link>
          )}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Registered patients"
            value={String(patients.length)}
            icon={Users}
            note={`${stats.withUpcoming} with a visit booked`}
          />
          <StatCard
            label="Booked in"
            value={String(stats.withUpcoming)}
            icon={CalendarCheck}
            note={`${patients.length - stats.withUpcoming} with nothing scheduled`}
          />
          <StatCard
            label="Due for recall"
            value={String(stats.lapsed)}
            icon={UserRoundSearch}
            tone={stats.lapsed > 0 ? "alert" : "accent"}
            note={
              stats.lapsed === 0
                ? "Everyone seen recently"
                : `Not seen in ${RECALL_MONTHS}+ months`
            }
          />
        </div>

        {/* Search + channel filter */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, or email"
              aria-label="Search patients"
              className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div className="flex shrink-0 gap-1 rounded-panel bg-white p-1">
            {CHANNEL_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setChannel(f.value)}
                aria-pressed={channel === f.value}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  channel === f.value
                    ? "bg-teal-100 text-teal-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLapsedOnly((prev) => !prev)}
            aria-pressed={lapsedOnly}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
              lapsedOnly
                ? "bg-rose-100 text-rose-700"
                : "bg-white text-slate-500 hover:text-slate-700",
            )}
          >
            <UserRoundSearch className="h-3.5 w-3.5" />
            Due for recall
          </button>
        </div>

        {/* Results */}
        <div className="overflow-hidden rounded-panel bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                {query || channel !== "all" ? "Matching patients" : "All patients"}
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {filtered.length}
              </span>
            </div>
          </div>

          {/* Column headers (desktop only) */}
          <div className="hidden border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_1.5rem] lg:gap-4">
            <span>Patient</span>
            <span>Phone</span>
            <span>Channel</span>
            <span>Last visit</span>
            <span>Next appointment</span>
            <span />
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <UserRound className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No patients match your search.</p>
              <p className="text-xs text-slate-400">
                Try a different name or phone number, or clear the channel filter.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {filtered.map((p) => {
                const summary = summaries.get(p.id);
                const channelStyle = CHANNEL_STYLES[p.preferredChannel];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/patients/${p.id}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_1.5rem] lg:gap-4"
                    >
                      {/* Name + avatar */}
                      <div className="flex min-w-0 items-center gap-3 lg:col-span-1">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                          {initials(p.fullName)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {p.fullName}
                            </p>
                            {summary && needsRecall(summary) && (
                              <span
                                className={cn(
                                  "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold lg:inline",
                                  RECALL_STATE_STYLES.lapsed.badge,
                                )}
                              >
                                Recall
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {age(p.dateOfBirth)} yrs
                            <span className="lg:hidden"> · {p.phone}</span>
                          </p>
                        </div>
                      </div>

                      {/* Phone */}
                      <span className="hidden truncate text-sm text-slate-600 lg:block">
                        {p.phone}
                      </span>

                      {/* Preferred channel */}
                      <span className="hidden lg:block">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                            channelStyle.badge,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", channelStyle.dot)} />
                          {channelStyle.label}
                        </span>
                      </span>

                      {/* Last visit — the date, plus how long ago in the
                          clinic's own terms, so a lapsed patient is visible
                          without doing the arithmetic. */}
                      <span className="hidden text-sm lg:block">
                        {summary?.lastVisit ? (
                          <>
                            <span className="block text-slate-600">
                              {fmtDate(summary.lastVisit.date)}
                            </span>
                            <span
                              className={cn(
                                "block text-[11px]",
                                summary.state === "lapsed" ? "text-rose-600" : "text-slate-400",
                              )}
                            >
                              {elapsedLabel(summary.monthsSinceAnchor)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-300">Never seen</span>
                        )}
                      </span>

                      {/* Next appointment */}
                      <span className="hidden text-sm lg:block">
                        {summary?.nextAppointment ? (
                          <span className="text-slate-600">
                            {fmtDate(summary.nextAppointment.date)}
                          </span>
                        ) : (
                          <span className="text-slate-300">None scheduled</span>
                        )}
                      </span>

                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
