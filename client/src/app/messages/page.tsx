"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MessageSquare, Search } from "lucide-react";
import { getMessages, getPatients, onMessagesChanged } from "@/lib/api";
import type { Channel, DeliveryStatus, Message, MessageType, Patient } from "@/lib/types";
import {
  CHANNEL_STYLES,
  DELIVERY_STATUS_STYLES,
  MESSAGE_TYPE_STYLES,
} from "@/lib/status-styles";
import { fmtDateTime, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type ChannelFilter = "all" | Channel;
type TypeFilter = "all" | MessageType;
type StatusFilter = "all" | DeliveryStatus;

const CHANNEL_FILTERS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "confirmation", label: "Confirmation" },
  { value: "reminder", label: "Reminder" },
  { value: "follow-up", label: "Follow-up" },
  { value: "birthday", label: "Birthday" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

export default function MessageLogPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const [msgs, pts] = await Promise.all([getMessages(), getPatients()]);
      if (!active) return;
      setMessages(msgs);
      setPatients(pts);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Delivery receipts arrive after the message is sent, so re-read the log when
  // one lands. Stands in for the websocket/poll a real provider would need.
  useEffect(() => {
    return onMessagesChanged(() => {
      void getMessages().then(setMessages);
    });
  }, []);

  const patientMap = useMemo(() => {
    const m = new Map<string, Patient>();
    patients.forEach((p) => m.set(p.id, p));
    return m;
  }, [patients]);

  const counts = useMemo(
    () => ({
      total: messages.length,
      delivered: messages.filter((m) => m.deliveryStatus === "delivered").length,
      sent: messages.filter((m) => m.deliveryStatus === "sent").length,
      failed: messages.filter((m) => m.deliveryStatus === "failed").length,
    }),
    [messages],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages
      .filter((m) => (channel === "all" ? true : m.channel === channel))
      .filter((m) => (type === "all" ? true : m.type === type))
      .filter((m) => (status === "all" ? true : m.deliveryStatus === status))
      .filter((m) => {
        if (!q) return true;
        const name = patientMap.get(m.patientId)?.fullName.toLowerCase() ?? "";
        return name.includes(q) || m.contentPreview.toLowerCase().includes(q);
      })
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [messages, channel, type, status, query, patientMap]);

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-20 rounded-xl bg-slate-200" />
          <div className="h-96 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Message log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every confirmation, reminder, follow-up, and birthday message — simulated in this
            prototype, nothing is actually sent.
          </p>
        </div>

        {/* Delivery summary */}
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Total messages" value={counts.total} />
          <Stat label="Delivered" value={counts.delivered} tone="teal" />
          <Stat label="Sent" value={counts.sent} tone="sky" />
          <Stat label="Failed" value={counts.failed} tone="rose" />
        </div>

        {counts.failed > 0 && status !== "failed" && (
          <button
            type="button"
            onClick={() => setStatus("failed")}
            className="mb-5 flex w-full items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-800 transition hover:bg-rose-100"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">
                {counts.failed} message{counts.failed === 1 ? "" : "s"} failed to deliver
              </span>{" "}
              — review and contact those patients another way.
            </span>
          </button>
        )}

        {/* Filters */}
        <div className="mb-5 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by patient or message text"
              aria-label="Search messages"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <FilterGroup
              label="Channel"
              options={CHANNEL_FILTERS}
              value={channel}
              onChange={setChannel}
            />
            <FilterGroup label="Type" options={TYPE_FILTERS} value={type} onChange={setType} />
            <FilterGroup
              label="Delivery"
              options={STATUS_FILTERS}
              value={status}
              onChange={setStatus}
            />
          </div>
        </div>

        {/* Log */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Messages</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {filtered.length}
            </span>
          </div>

          {/* Column headers (desktop) */}
          <div className="hidden border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-4">
            <span>Patient</span>
            <span>Channel</span>
            <span>Type</span>
            <span>Message</span>
            <span>Sent</span>
            <span>Delivery</span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No messages match those filters.</p>
              <button
                type="button"
                onClick={() => {
                  setChannel("all");
                  setType("all");
                  setStatus("all");
                  setQuery("");
                }}
                className="text-xs font-semibold text-teal-600 transition hover:text-teal-700"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((m) => {
                const patient = patientMap.get(m.patientId);
                const channelStyle = CHANNEL_STYLES[m.channel];
                const typeStyle = MESSAGE_TYPE_STYLES[m.type];
                const deliveryStyle = DELIVERY_STATUS_STYLES[m.deliveryStatus];

                return (
                  <li
                    key={m.id}
                    className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-4"
                  >
                    {/* Patient */}
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                        {patient ? initials(patient.fullName) : "?"}
                      </span>
                      {patient ? (
                        <Link
                          href={`/patients/${patient.id}`}
                          className="truncate text-sm font-medium text-slate-900 transition hover:text-teal-700"
                        >
                          {patient.fullName}
                        </Link>
                      ) : (
                        <span className="truncate text-sm text-slate-400">Unknown patient</span>
                      )}
                    </div>

                    {/* Channel + type — stacked inline on mobile */}
                    <div className="flex flex-wrap items-center gap-2 lg:contents">
                      <span className="lg:block">
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
                      <span className="lg:block">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium",
                            typeStyle.badge,
                          )}
                        >
                          {typeStyle.label}
                        </span>
                      </span>
                    </div>

                    {/* Message preview */}
                    <p className="truncate text-sm text-slate-600" title={m.contentPreview}>
                      {m.contentPreview}
                    </p>

                    {/* Timestamp */}
                    <span className="text-xs text-slate-500">{fmtDateTime(m.sentAt)}</span>

                    {/* Delivery status */}
                    <span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          deliveryStyle.badge,
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", deliveryStyle.dot)} />
                        {deliveryStyle.label}
                      </span>
                    </span>
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

// --- sub-components -------------------------------------------------------

const STAT_TONES = {
  slate: "text-slate-900",
  teal: "text-teal-600",
  sky: "text-sky-600",
  rose: "text-rose-600",
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

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              value === option.value
                ? "bg-teal-50 text-teal-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
