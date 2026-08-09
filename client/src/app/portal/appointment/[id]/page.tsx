"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  CalendarClock,
  CalendarOff,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Stethoscope,
  X,
} from "lucide-react";
import {
  createPatientRequest,
  getAppointment,
  getDoctorAvailability,
  getDoctors,
  getPatient,
  getPendingRequests,
  sendMessage,
  updateAppointmentStatus,
} from "@/lib/api";
import type {
  Appointment,
  Doctor,
  DoctorAvailability,
  Patient,
  PatientRequest,
} from "@/lib/types";
import { CLINIC } from "@/lib/clinic";
import { dateKey, fmtLongDate, fmtTime } from "@/lib/format";
import { bookableSlots } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type Panel = "none" | "reschedule" | "cancel";

export default function PatientAppointmentPage() {
  const { id } = useParams<{ id: string }>();

  const [appointment, setAppointment] = useState<Appointment | undefined>();
  const [patient, setPatient] = useState<Patient | undefined>();
  const [doctor, setDoctor] = useState<Doctor | undefined>();
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const appt = await getAppointment(id);
    const [docs, avail, reqs] = await Promise.all([
      getDoctors(),
      getDoctorAvailability(),
      getPendingRequests(),
    ]);
    const pat = appt ? await getPatient(appt.patientId) : undefined;
    return { appt, pat, docs, avail, reqs };
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { appt, pat, docs, avail, reqs } = await load();
      if (!active) return;
      setAppointment(appt);
      setPatient(pat);
      setDoctor(docs.find((d) => d.id === appt?.doctorId) ?? docs[0]);
      setAvailability(avail);
      setRequests(reqs);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const openRequests = useMemo(
    () => requests.filter((r) => r.appointmentId === id && r.status === "pending"),
    [requests, id],
  );

  // Slots the patient may ask for — same availability rules staff see.
  const slotOptions = useMemo(() => {
    if (!preferredDate) return [];
    return bookableSlots(new Date(`${preferredDate}T00:00:00`), [], availability).map(
      (s) => s.time,
    );
  }, [preferredDate, availability]);

  async function confirmAttendance() {
    if (!appointment || !patient) return;
    setBusy(true);
    try {
      const updated = await updateAppointmentStatus(appointment.id, "confirmed");
      if (updated) setAppointment({ ...updated });
      await sendMessage({
        patientId: patient.id,
        appointmentId: appointment.id,
        channel: patient.preferredChannel,
        type: "confirmation",
        contentPreview: `${patient.fullName} confirmed attendance for ${fmtLongDate(appointment.date)}.`,
      });
      setDone("Thank you — your attendance is confirmed. We'll see you then.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(type: PatientRequest["requestType"]) {
    if (!appointment || !patient) return;
    setBusy(true);
    try {
      const created = await createPatientRequest({
        appointmentId: appointment.id,
        patientId: patient.id,
        requestType: type,
        requestedDate: type === "reschedule" ? preferredDate || undefined : undefined,
        requestedTime: type === "reschedule" ? preferredTime || undefined : undefined,
        reason: reason.trim() || undefined,
      });
      setRequests((prev) => [created, ...prev]);
      setPanel("none");
      setReason("");
      setPreferredDate("");
      setPreferredTime("");
      setDone("Request sent — our staff will confirm shortly.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-md animate-pulse space-y-4">
          <div className="h-40 rounded-2xl bg-slate-200" />
          <div className="h-56 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!appointment || !patient) {
    return (
      <div className="px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <CalendarOff className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Appointment not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This link may have expired. Please call the clinic on{" "}
            <a href={`tel:${CLINIC.phoneDial}`} className="font-medium text-teal-700">
              {CLINIC.phone}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const isCancelled = appointment.status === "cancelled";
  const isConfirmed = appointment.status === "confirmed";
  const isPast = appointment.date < dateKey(new Date());
  const actionsAvailable = !isCancelled && !isPast;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-md">
        {/* Clinic branding — patients reach this page cold from a message link,
            so the clinic should be recognisable before anything else. */}
        <Image
          src={CLINIC.logo}
          alt={CLINIC.name}
          width={240}
          height={240}
          priority
          className="mb-5 h-16 w-auto object-contain"
        />

        {/* Greeting */}
        <p className="text-sm text-slate-500">Hello {patient.fullName.split(" ")[0]},</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Your appointment</h1>

        {/* Appointment card */}
        <section
          className={cn(
            "mt-4 overflow-hidden rounded-2xl border shadow-sm",
            isCancelled ? "border-slate-200 bg-slate-50" : "border-teal-200 bg-white",
          )}
        >
          <div
            className={cn(
              "px-5 py-4",
              isCancelled ? "bg-slate-100" : isConfirmed ? "bg-teal-600" : "bg-teal-500",
            )}
          >
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                isCancelled ? "text-slate-500" : "text-teal-50",
              )}
            >
              {isCancelled
                ? "Cancelled"
                : isPast
                  ? "Past appointment"
                  : isConfirmed
                    ? "Confirmed"
                    : "Scheduled"}
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold",
                isCancelled ? "text-slate-600" : "text-white",
              )}
            >
              {fmtLongDate(appointment.date)}
            </p>
            <p className={cn("text-sm", isCancelled ? "text-slate-500" : "text-teal-50")}>
              {fmtTime(appointment.time)} · {appointment.durationMinutes} minutes
            </p>
          </div>

          <dl className="divide-y divide-slate-100">
            <Detail
              icon={<Stethoscope className="h-4 w-4" />}
              label="With"
              value={doctor?.fullName ?? "Your doctor"}
            />
            <Detail
              icon={<CalendarClock className="h-4 w-4" />}
              label="Appointment type"
              value={appointment.appointmentType}
            />
            <Detail
              icon={<MapPin className="h-4 w-4" />}
              label="Where"
              value={
                <>
                  <span className="block">{CLINIC.name}</span>
                  <span className="block text-slate-600">{CLINIC.addressLines.join(", ")}</span>
                </>
              }
            />
          </dl>
        </section>

        {/* Result banner */}
        {done && (
          <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {done}
          </p>
        )}

        {/* Outstanding requests */}
        {openRequests.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">
              {openRequests.length === 1 ? "Request pending" : "Requests pending"}
            </p>
            <ul className="mt-1 space-y-1">
              {openRequests.map((r) => (
                <li key={r.id} className="text-xs text-amber-800">
                  {r.requestType === "cancellation"
                    ? "Cancellation requested"
                    : `Reschedule requested${
                        r.requestedDate
                          ? ` for ${fmtLongDate(r.requestedDate)}${
                              r.requestedTime ? ` at ${fmtTime(r.requestedTime)}` : ""
                            }`
                          : ""
                      }`}{" "}
                  — awaiting staff confirmation.
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {actionsAvailable ? (
          <div className="mt-5 space-y-3">
            {panel === "none" && (
              <>
                <button
                  type="button"
                  onClick={() => void confirmAttendance()}
                  disabled={busy || isConfirmed}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isConfirmed ? "Attendance confirmed" : "Confirm attendance"}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPanel("reschedule")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <CalendarClock className="h-4 w-4" />
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("cancel")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Reschedule picker */}
            {panel === "reschedule" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">
                  When would suit you better?
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Pick a preferred time. Our staff will confirm before anything changes.
                </p>

                <label
                  htmlFor="preferredDate"
                  className="mt-4 block text-xs font-medium text-slate-600"
                >
                  Preferred date
                </label>
                <input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  min={dateKey(new Date())}
                  onChange={(e) => {
                    setPreferredDate(e.target.value);
                    setPreferredTime("");
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />

                {preferredDate && (
                  <>
                    <p className="mt-3 text-xs font-medium text-slate-600">Preferred time</p>
                    {slotOptions.length === 0 ? (
                      <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                        The clinic is closed that day. Try another date, or send the request
                        without a time and we&apos;ll call you.
                      </p>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {slotOptions.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setPreferredTime(time)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-sm font-medium transition",
                              preferredTime === time
                                ? "border-teal-400 bg-teal-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                            )}
                          >
                            {fmtTime(time)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <label htmlFor="reason" className="mt-4 block text-xs font-medium text-slate-600">
                  Anything we should know? (optional)
                </label>
                <textarea
                  id="reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submitRequest("reschedule")}
                    disabled={busy || !preferredDate}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send request
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("none")}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Back
                  </button>
                </div>
              </section>
            )}

            {/* Cancellation */}
            {panel === "cancel" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">
                  Request to cancel this appointment?
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Our staff will confirm. Your appointment stays booked until they do.
                </p>

                <label
                  htmlFor="cancelReason"
                  className="mt-4 block text-xs font-medium text-slate-600"
                >
                  Reason (optional)
                </label>
                <textarea
                  id="cancelReason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Feeling better, no longer needed."
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submitRequest("cancellation")}
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send cancellation request
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("none")}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Back
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {isCancelled
              ? "This appointment was cancelled. Call us any time to book again."
              : "This appointment has passed. Call us to book a follow-up."}
          </p>
        )}

        {/* Clinic footer */}
        <footer className="mt-8 rounded-2xl bg-slate-900 px-5 py-5 text-slate-300">
          <p className="text-sm font-semibold text-white">{CLINIC.name}</p>
          <p className="mt-2 flex items-start gap-2 text-xs">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{CLINIC.addressLines.join(", ")}</span>
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-xs">
            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <a href={`tel:${CLINIC.phoneDial}`} className="hover:text-white">
              {CLINIC.phone}
            </a>
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Please arrive 10 minutes early.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
