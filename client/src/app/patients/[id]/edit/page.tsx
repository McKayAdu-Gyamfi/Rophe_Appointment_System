"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { PatientForm } from "@/components/patient-form";
import { getPatient } from "@/lib/api";
import type { Patient } from "@/lib/types";

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await getPatient(id);
      if (!active) return;
      setPatient(found);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-96 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <UserRound className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Patient not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            No patient matches the id <span className="font-mono text-slate-600">{id}</span>.
          </p>
          <Link
            href="/patients"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-surface bg-slate-100 p-4 sm:p-5">
        <Link
          href={`/patients/${patient.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {patient.fullName}
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Edit patient</h1>
          <p className="mt-1 text-sm text-slate-500">
            Update contact details or change the preferred communication channel.
          </p>
        </div>

        <div className="rounded-panel bg-white p-5 sm:p-6">
          <PatientForm
            patient={patient}
            onCancel={() => router.push(`/patients/${patient.id}`)}
            onSaved={(saved) => router.push(`/patients/${saved.id}`)}
          />
        </div>
      </div>
    </div>
  );
}
