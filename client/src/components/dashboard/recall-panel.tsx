"use client";

import Link from "next/link";
import { UserRoundSearch } from "lucide-react";
import type { Patient } from "@/lib/types";
import { elapsedLabel, reasonLabel, type PatientVisitSummary } from "@/lib/visits";
import { CHANNEL_STYLES } from "@/lib/status-styles";
import { Panel, PanelHeader, PanelLink, EmptyNote } from "./panel";
import { cn } from "@/lib/utils";

// The long tail beside the follow-up panel: patients nobody has seen for six
// months. Deliberately read-only here — the recall screen owns sending,
// because a recall is worked as a batch and a one-at-a-time button on the
// dashboard would quietly encourage the slower habit. This panel's job is to
// make sure the list is not forgotten between sweeps.
export function RecallPanel({
  entries,
  limit = 5,
}: {
  entries: { patient: Patient; summary: PatientVisitSummary }[];
  limit?: number;
}) {
  const shown = entries.slice(0, limit);
  const extra = entries.length - shown.length;

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Due for recall"
        action={<PanelLink href="/recalls">Open recalls</PanelLink>}
      />

      {shown.length === 0 ? (
        <EmptyNote>No patient has gone six months without being seen.</EmptyNote>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-slate-200">
            {shown.map(({ patient, summary }) => (
              <li key={patient.id} className="flex items-start gap-3 py-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <UserRoundSearch className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/patients/${patient.id}`}
                    className="block truncate text-[13px] font-bold text-slate-900 transition hover:text-teal-700"
                  >
                    {patient.fullName}
                  </Link>
                  <p className="truncate text-[11px] text-slate-500">{reasonLabel(summary)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        CHANNEL_STYLES[patient.preferredChannel].dot,
                      )}
                    />
                    {CHANNEL_STYLES[patient.preferredChannel].label} · {patient.phone}
                  </p>
                </div>

                {/* The silence clock, not the last-visit one: a patient who
                    has never been seen still has a length of quiet. */}
                <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-amber-700">
                  {elapsedLabel(summary.monthsQuiet)}
                </span>
              </li>
            ))}
          </ul>

          {extra > 0 && (
            <Link
              href="/recalls"
              className="mt-3 block rounded-lg bg-slate-100 py-2 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              {extra} more waiting
            </Link>
          )}
        </>
      )}
    </Panel>
  );
}
