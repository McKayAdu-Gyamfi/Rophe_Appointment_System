"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarOff } from "lucide-react";
import { AppointmentForm } from "@/components/appointment-form";
import { getAppointment } from "@/lib/api";
import type { Appointment } from "@/lib/types";
import { fmtLongDate, fmtTime } from "@/lib/format";

export default function ReschedulePage() {
  const { id } = useParams<{ id: string }>();

  const [appointment, setAppointment] = useState<Appointment | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await getAppointment(id);
      if (!active) return;
      setAppointment(found);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-96 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <CalendarOff className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Appointment not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            No appointment matches the id <span className="font-mono text-slate-600">{id}</span>.
          </p>
          <Link
            href="/appointments"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to appointments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/appointments"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Appointments
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Edit / reschedule</h1>
          <p className="mt-1 text-sm text-slate-500">
            Currently {fmtLongDate(appointment.date)} at {fmtTime(appointment.time)}. Saving marks
            the appointment as rescheduled and sends an updated confirmation.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <AppointmentForm appointment={appointment} />
        </div>
      </div>
    </div>
  );
}
