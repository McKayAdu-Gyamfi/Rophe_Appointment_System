"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCheck, FileText, MessageSquare, Search, Send } from "lucide-react";
import { getMessages, getPatients, onMessagesChanged } from "@/lib/api";
import type { Channel, DeliveryStatus, Message, MessageType, Patient } from "@/lib/types";
import {
  CHANNEL_STYLES,
  DELIVERY_STATUS_STYLES,
  MESSAGE_TYPE_STYLES,
} from "@/lib/status-styles";
import { fmtDateTime, initials } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { TemplatesPanel } from "@/components/messages/templates-panel";
import { cn } from "@/lib/utils";

type Tab = "log" | "templates";

type ChannelFilter = "all" | Channel;
type TypeFilter = "all" | MessageType;
type StatusFilter = "all" | DeliveryStatus;

const TABS: { value: Tab; label: string; icon: typeof MessageSquare }[] = [
  { value: "log", label: "Log", icon: MessageSquare },
  { value: "templates", label: "Templates", icon: FileText },
];

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
  { value: "recall", label: "Recall" },
  { value: "birthday", label: "Birthday" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

export default function MessagesPage() {
  const [tab, setTab] = useState<Tab>("log");
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

  const deliveredRate =
    counts.total === 0 ? 0 : Math.round((counts.delivered / counts.total) * 100);

  // Names the channel the clinic leans on most — more useful under the total
  // than a growth figure the prototype has no baseline for.
  const busiestChannel = useMemo(() => {
    const tally = new Map<Channel, number>();
    messages.forEach((m) => tally.set(m.channel, (tally.get(m.channel) ?? 0) + 1));
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${CHANNEL_STYLES[top[0]].label} and others` : "all channels";
  }, [messages]);

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
        <div className="mx-auto max-w-7xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-20 rounded-xl bg-slate-200" />
          <div className="h-96 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-surface bg-slate-100 p-4 sm:p-5">
        {/* Tabs — the log is what was sent, templates are what gets sent. */}
        <div className="mb-5 flex w-fit gap-1 rounded-panel bg-white p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                aria-pressed={tab === t.value}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
                  tab === t.value
                    ? "bg-teal-100 text-teal-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "templates" ? (
          <TemplatesPanel />
        ) : (
          <>
          {/* Header */}
          <div className="mb-6">
            <p className="mt-1 text-sm text-slate-500">
              Every confirmation, reminder, follow-up, and birthday message — simulated in this
              prototype, nothing is actually sent.
            </p>
          </div>

          {/* Delivery summary */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total messages"
              value={String(counts.total)}
              icon={MessageSquare}
              note={`Across ${busiestChannel}`}
            />
            <StatCard
              label="Delivered"
              value={String(counts.delivered)}
              icon={CheckCheck}
              note={counts.total === 0 ? "Nothing sent yet" : `${deliveredRate}% of everything sent`}
            />
            <StatCard
              label="Sent"
              value={String(counts.sent)}
              icon={Send}
              note={counts.sent === 0 ? "Nothing in flight" : "Awaiting delivery receipt"}
            />
            <StatCard
              label="Failed"
              value={String(counts.failed)}
              icon={AlertTriangle}
              tone={counts.failed > 0 ? "alert" : "accent"}
              note={counts.failed === 0 ? "Everything got through" : "Reach them another way"}
            />
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
                className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-teal-600"
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
          <div className="overflow-hidden rounded-panel bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Messages</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {filtered.length}
              </span>
            </div>

            {/* Column headers (desktop) */}
            <div className="hidden border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-4">
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
              <ul className="divide-y divide-slate-200">
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
          </>
        )}
      </div>
    </div>
  );
}

// --- sub-components -------------------------------------------------------


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
      <div className="flex flex-wrap gap-1 rounded-panel bg-white p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              value === option.value
                ? "bg-teal-100 text-teal-700"
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
