"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  Inbox,
  Loader2,
  MessageSquareQuote,
  X,
} from "lucide-react";
import {
  getAppointments,
  getDoctorAvailability,
  getPatients,
  getPendingRequests,
  respondToRequest,
  sendMessage,
  type RequestDecision,
} from "@/lib/api";
import type {
  Appointment,
  DoctorAvailability,
  Patient,
  PatientRequest,
} from "@/lib/types";
import {
  APPOINTMENT_STATUS_STYLES,
  CHANNEL_STYLES,
  REQUEST_STATUS_STYLES,
  REQUEST_TYPE_STYLES,
} from "@/lib/status-styles";
import { fmtDate, fmtLongDate, fmtTime, initials } from "@/lib/format";
import { buildDaySlots } from "@/lib/schedule";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export default function PendingRequestsPage() {
  const { role } = useRole();
  const canAct = role === "front-desk";

  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [reqs, appts, pts, avail] = await Promise.all([
        getPendingRequests(),
        getAppointments(),
        getPatients(),
        getDoctorAvailability(),
      ]);
      if (!active) return;
      setRequests(reqs);
      setAppointments(appts);
      setPatients(pts);
      setAvailability(avail);
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

  const appointmentMap = useMemo(() => {
    const m = new Map<string, Appointment>();
    appointments.forEach((a) => m.set(a.id, a));
    return m;
  }, [appointments]);

  const pending = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);
  const resolved = useMemo(() => requests.filter((r) => r.status !== "pending"), [requests]);

  /**
   * Flags a requested slot the doctor can't actually take. Staff can still
   * confirm — they may know something the calendar doesn't — but they see it.
   */
  const conflictFor = useCallback(
    (request: PatientRequest): string | null => {
      if (request.requestType !== "reschedule") return null;
      if (!request.requestedDate || !request.requestedTime) return null;

      const date = new Date(`${request.requestedDate}T00:00:00`);
      const others = appointments.filter((a) => a.id !== request.appointmentId);
      const slot = buildDaySlots(date, others, availability).find(
        (s) => s.time === request.requestedTime,
      );

      if (!slot) return "That time is outside clinic hours.";
      if (!slot.available) return "The doctor isn't available at that time.";
      if (slot.appointments.length > 0 || slot.occupied) return "That slot is already booked.";
      return null;
    },
    [appointments, availability],
  );

  const respond = useCallback(
    async (request: PatientRequest, decision: RequestDecision) => {
      const patient = patientMap.get(request.patientId);
      setPendingId(request.id);
      try {
        const updated = await respondToRequest(request.id, decision);
        if (!updated) {
          toast.error("That request could no longer be found.");
          return;
        }

        // The cascade mutates the linked appointment, so re-read it.
        const appts = await getAppointments();
        setAppointments(appts);
        setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...updated } : r)));

        if (patient) {
          const isCancellation = request.requestType === "cancellation";
          const when =
            request.requestedDate && request.requestedTime
              ? `${fmtDate(request.requestedDate)} at ${fmtTime(request.requestedTime)}`
              : "";

          const preview =
            decision === "confirmed"
              ? isCancellation
                ? "Your cancellation is confirmed. Call us whenever you'd like to rebook."
                : `Your appointment has been moved to ${when}.`
              : isCancellation
                ? "We couldn't cancel that appointment — please call the clinic."
                : "We couldn't move your appointment to that time — please call the clinic.";

          await sendMessage({
            patientId: patient.id,
            appointmentId: request.appointmentId,
            channel: patient.preferredChannel,
            type: "confirmation",
            contentPreview: preview,
          });

          toast.success(
            decision === "confirmed" ? "Request confirmed" : "Request declined",
            {
              description: `${patient.fullName} notified via ${CHANNEL_STYLES[patient.preferredChannel].label}.`,
            },
          );
        }
      } catch {
        toast.error("Something went wrong. Try again.");
      } finally {
        setPendingId(null);
      }
    },
    [patientMap],
  );

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-40 rounded-xl bg-slate-200" />
          <div className="h-40 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Pending requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reschedule and cancellation requests submitted by patients. Nothing changes on the
            calendar until you confirm.
          </p>
        </div>

        {/* Pending queue */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Awaiting your decision</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {pending.length}
            </span>
          </div>

          {pending.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center shadow-sm">
              <Check className="mx-auto h-8 w-8 text-teal-400" />
              <p className="mt-2 text-sm font-medium text-slate-600">
                No requests waiting — the queue is clear.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {pending.map((request) => (
                <li key={request.id}>
                  <RequestCard
                    request={request}
                    patient={patientMap.get(request.patientId)}
                    appointment={appointmentMap.get(request.appointmentId)}
                    conflict={conflictFor(request)}
                    busy={pendingId === request.id}
                    disabled={pendingId !== null}
                    canAct={canAct}
                    onRespond={(decision) => void respond(request, decision)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Resolved history */}
        {resolved.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Recently resolved</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {resolved.length}
              </span>
            </div>
            <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {resolved.map((request) => {
                const patient = patientMap.get(request.patientId);
                const style = REQUEST_STATUS_STYLES[request.status];
                return (
                  <li
                    key={request.id}
                    className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {patient ? initials(patient.fullName) : "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {patient?.fullName ?? "Unknown patient"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {REQUEST_TYPE_STYLES[request.requestType].label} request
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
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// --- request card ----------------------------------------------------------

function RequestCard({
  request,
  patient,
  appointment,
  conflict,
  busy,
  disabled,
  canAct,
  onRespond,
}: {
  request: PatientRequest;
  patient?: Patient;
  appointment?: Appointment;
  conflict: string | null;
  busy: boolean;
  disabled: boolean;
  canAct: boolean;
  onRespond: (decision: RequestDecision) => void;
}) {
  const isCancellation = request.requestType === "cancellation";

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Who + what */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {patient ? initials(patient.fullName) : "?"}
          </span>
          <div className="min-w-0">
            {patient ? (
              <Link
                href={`/patients/${patient.id}`}
                className="truncate text-sm font-semibold text-slate-900 transition hover:text-teal-700"
              >
                {patient.fullName}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-slate-400">Unknown patient</span>
            )}
            {patient && (
              <p className="truncate text-xs text-slate-500">
                {patient.phone} · prefers {CHANNEL_STYLES[patient.preferredChannel].label}
              </p>
            )}
          </div>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            REQUEST_TYPE_STYLES[request.requestType].badge,
          )}
        >
          {isCancellation ? <Ban className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
          {REQUEST_TYPE_STYLES[request.requestType].label}
        </span>
      </div>

      {/* The change being asked for */}
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Currently
            </p>
            {appointment ? (
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                {fmtLongDate(appointment.date)} · {fmtTime(appointment.time)}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-400">Appointment not found</p>
            )}
            {appointment && (
              <p className="mt-0.5 text-xs text-slate-500">{appointment.appointmentType}</p>
            )}
          </div>

          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />

          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              isCancellation ? "border-rose-200 bg-rose-50" : "border-teal-200 bg-teal-50",
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Requested
            </p>
            {isCancellation ? (
              <p className="mt-0.5 text-sm font-medium text-rose-800">Cancel the appointment</p>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-teal-800">
                {request.requestedDate ? fmtLongDate(request.requestedDate) : "No date given"}
                {request.requestedTime ? ` · ${fmtTime(request.requestedTime)}` : ""}
              </p>
            )}
          </div>
        </div>

        {request.reason && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span className="italic">“{request.reason}”</span>
          </p>
        )}

        {conflict && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {conflict} Confirming will book it anyway.
          </p>
        )}

        {appointment && (
          <p className="mt-3 text-xs text-slate-400">
            Current status:{" "}
            <span className="font-medium text-slate-600">
              {APPOINTMENT_STATUS_STYLES[appointment.status].label}
            </span>
          </p>
        )}
      </div>

      {/* Decision */}
      {canAct && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <button
            type="button"
            onClick={() => onRespond("confirmed")}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirm
          </button>
          <button
            type="button"
            onClick={() => onRespond("declined")}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Decline
          </button>
          <p className="ml-auto self-center text-xs text-slate-400">
            {patient
              ? `${patient.fullName.split(" ")[0]} is notified either way.`
              : "Patient will be notified."}
          </p>
        </div>
      )}
    </article>
  );
}
