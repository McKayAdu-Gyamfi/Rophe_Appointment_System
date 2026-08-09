"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search, UserRound, Users } from "lucide-react";
import { getAppointments, getPatients } from "@/lib/api";
import type { Appointment, Channel, Patient } from "@/lib/types";
import { CHANNEL_STYLES } from "@/lib/status-styles";
import { age, fmtDate, initials, startOfDay } from "@/lib/format";
import { useRole } from "@/lib/role-context";
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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");

  useEffect(() => {
    let active = true;
    (async () => {
      const [pts, appts] = await Promise.all([getPatients(), getAppointments()]);
      if (!active) return;
      setPatients(pts);
      setAppointments(appts);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Per-patient visit summary, derived once rather than per row.
  const summaries = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const map = new Map<string, { lastVisit?: Appointment; nextAppt?: Appointment; visits: number }>();

    for (const appt of appointments) {
      const entry = map.get(appt.patientId) ?? { visits: 0 };
      const when = startOfDay(new Date(appt.date)).getTime();

      if (appt.status === "attended") {
        entry.visits += 1;
        if (!entry.lastVisit || appt.date > entry.lastVisit.date) entry.lastVisit = appt;
      }
      if (when >= today && (appt.status === "booked" || appt.status === "confirmed")) {
        if (!entry.nextAppt || appt.date < entry.nextAppt.date) entry.nextAppt = appt;
      }
      map.set(appt.patientId, entry);
    }
    return map;
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digits(query);

    return patients
      .filter((p) => (channel === "all" ? true : p.preferredChannel === channel))
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
  }, [patients, query, channel]);

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-11 rounded-xl bg-slate-200" />
          <div className="h-96 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
            <p className="mt-1 text-sm text-slate-500">
              {patients.length} registered {patients.length === 1 ? "patient" : "patients"}
            </p>
          </div>
          {canEdit && (
            <Link
              href="/patients/new"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              Add patient
            </Link>
          )}
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
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div className="flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {CHANNEL_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setChannel(f.value)}
                aria-pressed={channel === f.value}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  channel === f.value
                    ? "bg-teal-50 text-teal-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
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
          <div className="hidden border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400 lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_1.5rem] lg:gap-4">
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
            <ul className="divide-y divide-slate-100">
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
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
                          {initials(p.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {p.fullName}
                          </p>
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

                      {/* Last visit */}
                      <span className="hidden text-sm text-slate-600 lg:block">
                        {summary?.lastVisit ? (
                          fmtDate(summary.lastVisit.date)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </span>

                      {/* Next appointment */}
                      <span className="hidden text-sm lg:block">
                        {summary?.nextAppt ? (
                          <span className="text-slate-600">{fmtDate(summary.nextAppt.date)}</span>
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
