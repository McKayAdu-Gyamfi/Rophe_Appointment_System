"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppointmentForm } from "@/components/appointment-form";

function BookAppointmentContent() {
  // Pre-filled when staff arrive by clicking a free slot on the calendar.
  const params = useSearchParams();

  return (
    <AppointmentForm
      initialPatientId={params.get("patientId") ?? undefined}
      initialDate={params.get("date") ?? undefined}
      initialTime={params.get("time") ?? undefined}
    />
  );
}

export default function BookAppointmentPage() {
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
          <h1 className="text-2xl font-semibold text-slate-900">Book appointment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Times are limited to the doctor&apos;s declared availability.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <Suspense
            fallback={
              <div className="animate-pulse space-y-4">
                <div className="h-24 rounded-xl bg-slate-200" />
                <div className="h-64 rounded-xl bg-slate-200" />
              </div>
            }
          >
            <BookAppointmentContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
