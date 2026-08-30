"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  Loader2,
  NotebookPen,
  Phone,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { updateAppointmentStatus } from "@/lib/api";
import type { Appointment, AppointmentStatus, Patient } from "@/lib/types";
import { APPOINTMENT_STATUS_STYLES, CHANNEL_STYLES } from "@/lib/status-styles";
import { fmtLongDate, fmtTime, initials } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Appointment view/edit/cancel/reschedule panel (PRD Section 3.1 #4).
// Opened by clicking an appointment anywhere on the calendar.
// ---------------------------------------------------------------------------

interface StatusAction {
  status: AppointmentStatus;
  label: string;
  className: string;
  icon: typeof Check;
}

const STATUS_ACTIONS: StatusAction[] = [
  {
    status: "confirmed",
    label: "Mark confirmed",
    className: "border-teal-200 bg-teal-100 text-teal-700 hover:bg-teal-100",
    icon: Check,
  },
  {
    status: "attended",
    label: "Mark attended",
    className: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    icon: Check,
  },
  {
    status: "missed",
    label: "Mark missed",
    className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    icon: XCircle,
  },
  {
    status: "cancelled",
    label: "Cancel appointment",
    className: "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
    icon: X,
  },
];

export interface AppointmentDetailDialogProps {
  appointment: Appointment | null;
  patient?: Patient;
  onClose: () => void;
  /** Called after a status change so the caller can refetch. */
  onChanged: (appointment: Appointment) => void;
}

export function AppointmentDetailDialog({
  appointment,
  patient,
  onClose,
  onChanged,
}: AppointmentDetailDialogProps) {
  const { role } = useRole();
  const canEdit = role === "front-desk";
  const [pending, setPending] = useState<AppointmentStatus | null>(null);

  useEffect(() => {
    if (!appointment) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [appointment, onClose]);

  if (!appointment) return null;

  const style = APPOINTMENT_STATUS_STYLES[appointment.status];

  async function applyStatus(status: AppointmentStatus) {
    if (!appointment) return;
    setPending(status);
    const updated = await updateAppointmentStatus(appointment.id, status);
    setPending(null);
    if (updated) onChanged(updated);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-sm font-semibold text-teal-700">
              {patient ? initials(patient.fullName) : <UserRound className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <h2 id="appointment-detail-title" className="truncate text-lg font-semibold">
                {patient ? (
                  // The name is the way into their visit history (PRD §3.2 #4).
                  <Link
                    href={`/patients/${patient.id}`}
                    className="text-slate-900 underline decoration-slate-300 decoration-dotted underline-offset-4 transition hover:text-teal-700 hover:decoration-teal-400"
                  >
                    {patient.fullName}
                  </Link>
                ) : (
                  <span className="text-slate-900">Unknown patient</span>
                )}
              </h2>
              <p className="truncate text-sm text-slate-500">{appointment.appointmentType}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Details */}
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2.5 text-sm text-slate-700">
              <CalendarClock className="h-4 w-4 text-slate-400" />
              <span className="font-medium">{fmtLongDate(appointment.date)}</span>
              <span className="text-slate-400">·</span>
              <span>{fmtTime(appointment.time)}</span>
              <span className="text-slate-400">·</span>
              <span>{appointment.durationMinutes} min</span>
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

          {patient && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-slate-400" />
                {patient.phone}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  CHANNEL_STYLES[patient.preferredChannel].badge,
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    CHANNEL_STYLES[patient.preferredChannel].dot,
                  )}
                />
                Prefers {CHANNEL_STYLES[patient.preferredChannel].label}
              </span>
            </div>
          )}

          {appointment.notes && (
            <div className="flex items-start gap-2.5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
              <NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>{appointment.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 border-t border-slate-200 bg-slate-100 p-5">
          {canEdit ? (
            <>
              <div className="flex flex-wrap gap-2">
                {STATUS_ACTIONS.filter((action) => action.status !== appointment.status).map(
                  (action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.status}
                        type="button"
                        disabled={pending !== null}
                        onClick={() => applyStatus(action.status)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                          action.className,
                        )}
                      >
                        {pending === action.status ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                        {action.label}
                      </button>
                    );
                  },
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/appointments/${appointment.id}/reschedule`}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  <CalendarClock className="h-4 w-4" />
                  Edit / reschedule
                </Link>
                <Link
                  href={`/patients/${appointment.patientId}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  <UserRound className="h-4 w-4" />
                  Patient record
                </Link>
              </div>
            </>
          ) : (
            <Link
              href={`/patients/${appointment.patientId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              <UserRound className="h-4 w-4" />
              View patient history
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
