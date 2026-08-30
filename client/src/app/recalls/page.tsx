"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Search,
  Send,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import {
  getDoctors,
  getMessageTemplates,
  getPatientRecalls,
  sendMessage,
  type RecallEntry,
} from "@/lib/api";
import type { Doctor, MessageTemplate } from "@/lib/types";
import {
  LAPSING_MONTHS,
  RECALL_COOLDOWN_DAYS,
  RECALL_MONTHS,
  isUnbooked,
  lastSeenLabel,
  reasonLabel,
  type PatientVisitSummary,
  type RecallReason,
} from "@/lib/visits";
import { CHANNEL_STYLES, RECALL_STATE_STYLES } from "@/lib/status-styles";
import { fmtDate, fmtRelative, initials } from "@/lib/format";
import { renderTemplate } from "@/lib/templates";
import { useRole } from "@/lib/role-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Patient recalls — the six-month sweep.
//
// Built from the clinic's own question: "the patients not showing up for the
// past 6 months". The doctor's clarification is what shapes this screen — the
// threshold is one number (time since they were last actually seen) but the
// *reason* they went quiet is three different conversations, so the reason
// travels with every row rather than being filtered away.
//
// The unit of work here is a sweep, not a row: front desk sits down once a
// month, selects everyone who is due, and sends. So selection is bulk by
// default, and anyone already contacted inside the cooldown is out of the
// list — the fastest way to make a recall system worthless is to let it text
// the same person every week.
//
// The page title lives in the top bar (see PAGE_META in lib/nav.ts).
// ---------------------------------------------------------------------------

type Tab = "due" | "lapsing" | "contacted" | "unbooked" | "all";

const TABS: { value: Tab; label: string }[] = [
  { value: "due", label: "Due now" },
  { value: "lapsing", label: "Lapsing soon" },
  { value: "contacted", label: "Contacted" },
  // Not outreach — records to correct. Parked at the end so it never sits
  // between two tabs that do send messages.
  { value: "unbooked", label: "Needs checking" },
  { value: "all", label: "All patients" },
];

const REASON_FILTERS: { value: "all" | RecallReason; label: string }[] = [
  { value: "all", label: "Any reason" },
  { value: "stopped-returning", label: "Stopped returning" },
  { value: "never-attended", label: "Never attended" },
];

/** Everything the screen reads. Shared by the first load and every refresh. */
function fetchRecallData() {
  return Promise.all([getPatientRecalls(), getMessageTemplates(), getDoctors()]);
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Which tab a summary belongs to. `all` matches everything. */
function inTab(summary: PatientVisitSummary, tab: Tab): boolean {
  switch (tab) {
    case "due":
      return summary.state === "lapsed" && !summary.recentlyContacted;
    case "lapsing":
      return summary.state === "lapsing";
    case "contacted":
      return summary.recentlyContacted;
    case "unbooked":
      return summary.state === "unbooked";
    case "all":
      return true;
  }
}

export default function RecallsPage() {
  const { role } = useRole();
  // Doctors can read the list — it is their patient population — but the
  // outreach is front desk's job, the same split as the follow-up panel.
  const canAct = role === "front-desk";

  const [entries, setEntries] = useState<RecallEntry[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [doctor, setDoctor] = useState<Doctor | undefined>();
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("due");
  const [reason, setReason] = useState<"all" | RecallReason>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  // Re-read after a send: the message that just went out is what moves the
  // patient from "due" to "contacted", so the list has to come back through
  // the same join rather than be patched in place.
  const refresh = useCallback(async () => {
    const [recalls, tpls, docs] = await fetchRecallData();
    setEntries(recalls);
    setTemplates(tpls);
    setDoctor(docs[0]);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [recalls, tpls, docs] = await fetchRecallData();
      if (!active) return;
      setEntries(recalls);
      setTemplates(tpls);
      setDoctor(docs[0]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const recallTemplate = useMemo(
    () => templates.find((t) => t.type === "recall"),
    [templates],
  );

  const counts = useMemo(() => {
    let due = 0;
    let lapsing = 0;
    let contacted = 0;
    let neverAttended = 0;
    let unbooked = 0;
    for (const { summary } of entries) {
      if (summary.state === "lapsed" && !summary.recentlyContacted) due += 1;
      if (summary.state === "lapsing") lapsing += 1;
      if (summary.recentlyContacted) contacted += 1;
      if (summary.state === "lapsed" && summary.reason === "never-attended") {
        neverAttended += 1;
      }
      if (isUnbooked(summary)) unbooked += 1;
    }
    return { due, lapsing, contacted, neverAttended, unbooked };
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digits(query);

    return entries
      .filter(({ summary }) => inTab(summary, tab))
      .filter(({ summary }) => (reason === "all" ? true : summary.reason === reason))
      .filter(({ patient }) => {
        if (!q) return true;
        if (patient.fullName.toLowerCase().includes(q)) return true;
        if (qDigits.length >= 2 && digits(patient.phone).includes(qDigits)) return true;
        return patient.email?.toLowerCase().includes(q) ?? false;
      });
  }, [entries, tab, reason, query]);

  // Only rows that can actually be sent to are selectable, so "select all"
  // never quietly includes someone the send would skip.
  const selectableIds = useMemo(
    () =>
      visible
        .filter(({ summary }) => summary.state === "lapsed" && !summary.recentlyContacted)
        .map(({ patient }) => patient.id),
    [visible],
  );

  const selectedCount = useMemo(
    () => selectableIds.filter((id) => selected.has(id)).length,
    [selectableIds, selected],
  );

  const allSelected = selectableIds.length > 0 && selectedCount === selectableIds.length;

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (selectableIds.every((id) => next.has(id))) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        selectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [selectableIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /**
   * Send one recall, using the clinic's template wording rather than a string
   * written here — the whole point of the templates screen is that staff can
   * change what these say without a deploy.
   */
  const sendRecall = useCallback(
    async (entry: RecallEntry) => {
      const { patient, summary } = entry;
      const body = recallTemplate
        ? renderTemplate(recallTemplate.body, {
            patient,
            doctor,
            lastVisitDate: summary.lastVisit?.date,
          })
        : `Hello ${patient.fullName.split(" ")[0]}, it has been a while since your last visit. Call the clinic to book a time.`;

      await sendMessage({
        patientId: patient.id,
        channel: patient.preferredChannel,
        type: "recall",
        contentPreview: body,
      });
      return body;
    },
    [recallTemplate, doctor],
  );

  const handleSendOne = useCallback(
    async (entry: RecallEntry) => {
      setSending(entry.patient.id);
      try {
        const body = await sendRecall(entry);
        await refresh();
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(entry.patient.id);
          return next;
        });
        toast.success(
          `Recall sent via ${CHANNEL_STYLES[entry.patient.preferredChannel].label}`,
          { description: `${entry.patient.fullName} — ${body}` },
        );
      } catch {
        toast.error("Couldn't send that recall. Try again.");
      } finally {
        setSending(null);
      }
    },
    [sendRecall, refresh],
  );

  const handleSweep = useCallback(async () => {
    const batch = entries.filter(({ patient }) => selected.has(patient.id));
    if (batch.length === 0) return;

    setSweeping(true);
    try {
      // Sequential on purpose: the real provider is rate-limited, and a
      // partial failure should stop the sweep rather than half-send it.
      for (const entry of batch) {
        await sendRecall(entry);
      }
      await refresh();
      setSelected(new Set());
      toast.success(`${batch.length} recall${batch.length === 1 ? "" : "s"} sent`, {
        description: "Each went out on the patient's preferred channel. See the message log.",
      });
    } catch {
      toast.error("The sweep stopped part-way. Check the message log and retry the rest.");
      await refresh();
    } finally {
      setSweeping(false);
    }
  }, [entries, selected, sendRecall, refresh]);

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-24 rounded-xl bg-slate-200" />
          <div className="h-96 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-surface bg-slate-100 p-4 sm:p-5">
        {/* What this list means. Worth the space: "lapsed" is the clinic's own
            word for something the system had to be told how to measure. */}
        <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            Patients the clinic has not seen for {RECALL_MONTHS} months — whether they stopped
            booking, booked and never came, or never booked at all. Anyone with a visit already
            on the calendar is left out, and anyone contacted in the last {RECALL_COOLDOWN_DAYS}{" "}
            days moves to <span className="font-medium text-slate-700">Contacted</span> so the
            next sweep skips them. Records with no appointment at all are not recalls — the
            clinic books at registration, so those are unfinished entries and sit under{" "}
            <span className="font-medium text-slate-700">Needs checking</span>.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Due for recall"
            value={String(counts.due)}
            icon={UserRoundSearch}
            tone={counts.due > 0 ? "alert" : "accent"}
            note={
              counts.due === 0
                ? "Nobody is overdue"
                : `Not seen in ${RECALL_MONTHS}+ months`
            }
          />
          <StatCard
            label="Lapsing soon"
            value={String(counts.lapsing)}
            icon={Clock}
            note={`Past ${LAPSING_MONTHS} months, not yet overdue`}
          />
          <StatCard
            label="Never attended"
            value={String(counts.neverAttended)}
            icon={UsersRound}
            note="Of those due — booked, but never came in"
          />
          <StatCard
            label="Contacted"
            value={String(counts.contacted)}
            icon={CheckCircle2}
            note={`Recall sent in the last ${RECALL_COOLDOWN_DAYS} days`}
          />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const active = tab === t.value;
              const count =
                t.value === "due"
                  ? counts.due
                  : t.value === "lapsing"
                    ? counts.lapsing
                    : t.value === "contacted"
                      ? counts.contacted
                      : t.value === "unbooked"
                        ? counts.unbooked
                        : entries.length;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-teal-700 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "tnum rounded-full px-1.5 py-0.5 text-[11px]",
                      active ? "bg-teal-800 text-teal-50" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or phone"
                aria-label="Search patients due for recall"
                className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as "all" | RecallReason)}
              aria-label="Filter by reason"
              className="rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-teal-600"
            >
              {REASON_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tab === "unbooked" && counts.unbooked > 0 && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              These patient records have no appointment against them. Since the clinic registers
              and books together, each one is most likely an unfinished registration or a
              duplicate — worth opening and either booking in or removing. No recall is sent from
              here.
            </p>
          </div>
        )}

        {/* Sweep bar — appears only when there is something to send. */}
        {canAct && selectableIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : `Select all ${selectableIds.length} due`}
              </span>
            </label>

            <button
              type="button"
              onClick={() => void handleSweep()}
              disabled={selectedCount === 0 || sweeping}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sweeping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sweeping
                ? "Sending…"
                : selectedCount === 0
                  ? "Send recalls"
                  : `Send ${selectedCount} recall${selectedCount === 1 ? "" : "s"}`}
            </button>
          </div>
        )}

        {/* List */}
        <div className="overflow-hidden rounded-panel bg-white">
          {visible.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <ul className="divide-y divide-slate-200">
              {visible.map((entry) => (
                <RecallRow
                  key={entry.patient.id}
                  entry={entry}
                  canAct={canAct}
                  selectable={
                    entry.summary.state === "lapsed" && !entry.summary.recentlyContacted
                  }
                  checked={selected.has(entry.patient.id)}
                  onToggle={() => toggleOne(entry.patient.id)}
                  sending={sending === entry.patient.id}
                  onSend={() => void handleSendOne(entry)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// --- sub-components -------------------------------------------------------

function RecallRow({
  entry,
  canAct,
  selectable,
  checked,
  onToggle,
  sending,
  onSend,
}: {
  entry: RecallEntry;
  canAct: boolean;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
  sending: boolean;
  onSend: () => void;
}) {
  const { patient, summary } = entry;
  const state = RECALL_STATE_STYLES[summary.state];
  const channel = CHANNEL_STYLES[patient.preferredChannel];

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap">
      {canAct && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={!selectable}
          aria-label={`Select ${patient.fullName} for recall`}
          className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700 focus:ring-teal-600 disabled:opacity-30"
        />
      )}

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
        {initials(patient.fullName)}
      </span>

      <div className="min-w-0 flex-1">
        <Link
          href={`/patients/${patient.id}`}
          className="block truncate text-sm font-semibold text-slate-900 transition hover:text-teal-700"
        >
          {patient.fullName}
        </Link>
        <p className="truncate text-xs text-slate-500">{reasonLabel(summary)}</p>
      </div>

      {/* Last seen — the number the clinic asked for. */}
      <div className="w-32 shrink-0">
        <p className="text-sm font-medium text-slate-900">{lastSeenLabel(summary)}</p>
        <p className="truncate text-[11px] text-slate-400">
          {summary.lastVisit
            ? fmtDate(summary.lastVisit.date)
            : `Registered ${fmtDate(summary.anchorDate)}`}
        </p>
      </div>

      <div className="w-28 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className={cn("h-1.5 w-1.5 rounded-full", channel.dot)} />
          {channel.label}
        </span>
        <p className="truncate text-[11px] text-slate-400">{patient.phone}</p>
      </div>

      <span
        className={cn(
          "inline-flex w-28 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          state.badge,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", state.dot)} />
        {summary.recentlyContacted && summary.state === "lapsed" ? "Contacted" : state.label}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {canAct && selectable && (
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Recall
          </button>
        )}
        {canAct && summary.recentlyContacted && (
          <span className="text-[11px] text-slate-400">
            Sent {summary.lastRecallAt ? fmtRelative(summary.lastRecallAt) : ""}
          </span>
        )}
        {canAct && (
          <Link
            href={`/appointments/book?patientId=${patient.id}`}
            aria-label={`Book an appointment for ${patient.fullName}`}
            title="Book an appointment"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-teal-700"
          >
            <CalendarPlus className="h-4 w-4" />
          </Link>
        )}
      </div>
    </li>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const copy: Record<Tab, string> = {
    due: `Nobody has gone ${RECALL_MONTHS} months without being seen. Nothing to chase.`,
    lapsing: "No patient is approaching the six-month mark.",
    contacted: `No recall has gone out in the last ${RECALL_COOLDOWN_DAYS} days.`,
    unbooked: "Every patient record has an appointment against it.",
    all: "No patients match this search.",
  };

  return (
    <div className="px-4 py-16 text-center">
      <UserRoundSearch className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm text-slate-500">{copy[tab]}</p>
    </div>
  );
}
