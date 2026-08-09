"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PatientForm } from "@/components/patient-form";

export default function AddPatientPage() {
  const router = useRouter();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/patients"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Patients
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Add patient</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register a new patient and set how the clinic should reach them.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <PatientForm
            onCancel={() => router.push("/patients")}
            onSaved={(patient) => router.push(`/patients/${patient.id}`)}
          />
        </div>
      </div>
    </div>
  );
}
