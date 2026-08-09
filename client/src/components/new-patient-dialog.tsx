"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { PatientForm } from "./patient-form";
import type { Patient } from "@/lib/types";

// ---------------------------------------------------------------------------
// "+ New patient" inline flow, for use from the booking form (Prompt 7).
//
// Wraps PatientForm in a modal so staff can register a walk-in without losing
// the half-filled appointment they're in the middle of booking. The newly
// created patient is handed back via onCreated so the caller can select it.
// ---------------------------------------------------------------------------

export interface NewPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (patient: Patient) => void;
}

export function NewPatientDialog({ open, onOpenChange, onCreated }: NewPatientDialogProps) {
  // Escape closes; body scroll locks while the modal is up.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-patient-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <h2 id="new-patient-title" className="text-lg font-semibold text-slate-900">
              New patient
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Register the patient, then continue booking.
            </p>
          </div>
        </div>

        <PatientForm
          compact
          submitLabel="Add & select"
          onCancel={() => onOpenChange(false)}
          onSaved={(patient) => {
            onCreated(patient);
            onOpenChange(false);
          }}
        />
      </div>
    </div>
  );
}

/** Convenience state hook for callers: `const dialog = useNewPatientDialog()`. */
export function useNewPatientDialog() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, openDialog: () => setOpen(true) };
}
