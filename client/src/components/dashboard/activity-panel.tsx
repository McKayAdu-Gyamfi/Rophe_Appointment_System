"use client";

import { useMemo } from "react";
import { BellRing, Cake, CheckCheck, Send, UserRoundSearch, type LucideIcon } from "lucide-react";
import type { Message, MessageType, Patient } from "@/lib/types";
import { fmtRelative } from "@/lib/format";
import { DELIVERY_STATUS_STYLES } from "@/lib/status-styles";
import { Panel, PanelHeader, PanelMenuLink, EmptyNote } from "./panel";
import { cn } from "@/lib/utils";

// The reference's "Recent Activity" feed. Messages are the only events the
// system timestamps — patient requests carry no created-at — so the feed is
// built from the message log rather than mixing in entries that would sort
// into the wrong place.

const ICONS: Record<MessageType, LucideIcon> = {
  confirmation: CheckCheck,
  reminder: BellRing,
  "follow-up": Send,
  recall: UserRoundSearch,
  birthday: Cake,
};

const TITLES: Record<MessageType, string> = {
  confirmation: "Confirmation sent",
  reminder: "Reminder sent",
  "follow-up": "Follow-up sent",
  recall: "Recall sent",
  birthday: "Birthday greeting sent",
};

export function ActivityPanel({
  messages,
  patients,
  limit = 7,
}: {
  messages: Message[];
  patients: Map<string, Patient>;
  limit?: number;
}) {
  const recent = useMemo(
    () =>
      [...messages]
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        .slice(0, limit),
    [messages, limit],
  );

  return (
    <Panel>
      <PanelHeader
        title="Recent activity"
        action={<PanelMenuLink href="/messages" label="Open the message log" />}
      />

      {recent.length === 0 ? (
        <EmptyNote>No messages sent yet.</EmptyNote>
      ) : (
        <ul className="mt-3 space-y-3.5">
          {recent.map((message) => {
            const Icon = ICONS[message.type];
            const failed = message.deliveryStatus === "failed";
            return (
              <li key={message.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    failed ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-slate-900">
                    {failed
                      ? `${DELIVERY_STATUS_STYLES.failed.label}: ${TITLES[message.type].toLowerCase()}`
                      : TITLES[message.type]}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {patients.get(message.patientId)?.fullName ?? "Unknown patient"} ·{" "}
                    {message.channel === "whatsapp" ? "WhatsApp" : message.channel.toUpperCase()}
                  </span>
                </span>

                <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-slate-400">
                  {fmtRelative(message.sentAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
