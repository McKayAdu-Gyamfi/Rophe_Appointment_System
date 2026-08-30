"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { createPatient, updatePatient } from "@/lib/api";
import type { Channel, Patient } from "@/lib/types";
import { CHANNEL_STYLES } from "@/lib/status-styles";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared Add/Edit patient form (PRD Section 3.1 #3).
//
// Used standalone on /patients/new and /patients/[id]/edit, and embedded in a
// dialog from the booking flow ("+ New patient") — see new-patient-dialog.tsx.
// ---------------------------------------------------------------------------

interface FormState {
  fullName: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  dateOfBirth: string;
  preferredChannel: Channel;
  notes: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const CHANNELS: Channel[] = ["whatsapp", "sms", "email"];

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function initialState(patient?: Patient): FormState {
  return {
    fullName: patient?.fullName ?? "",
    phone: patient?.phone ?? "",
    whatsappNumber: patient?.whatsappNumber ?? "",
    email: patient?.email ?? "",
    dateOfBirth: patient?.dateOfBirth ?? "",
    preferredChannel: patient?.preferredChannel ?? "whatsapp",
    notes: patient?.notes ?? "",
  };
}

/**
 * Validation deliberately enforces that the chosen channel has an address to
 * send to — a WhatsApp-preferring patient with no WhatsApp number would
 * silently fail once real messaging is wired up in Phase 3.
 */
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (form.fullName.trim().length < 2) {
    errors.fullName = "Enter the patient's full name.";
  }

  if (!form.phone.trim()) {
    errors.phone = "Phone number is required.";
  } else if (digits(form.phone).length < 9) {
    errors.phone = "That doesn't look like a complete phone number.";
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (form.preferredChannel === "whatsapp" && !form.whatsappNumber.trim()) {
    errors.whatsappNumber = "Add a WhatsApp number, or tick “Same as phone”.";
  }

  if (form.preferredChannel === "email" && !form.email.trim()) {
    errors.email = "Email is required when Email is the preferred channel.";
  }

  if (!form.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else {
    const dob = new Date(form.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      errors.dateOfBirth = "Enter a valid date.";
    } else if (dob.getTime() > Date.now()) {
      errors.dateOfBirth = "Date of birth can't be in the future.";
    } else if (dob.getFullYear() < 1900) {
      errors.dateOfBirth = "Enter a date after 1900.";
    }
  }

  return errors;
}

export interface PatientFormProps {
  /** Present = edit mode; absent = create mode. */
  patient?: Patient;
  onSaved: (patient: Patient) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** Tighter spacing + single column, for use inside a dialog. */
  compact?: boolean;
}

export function PatientForm({
  patient,
  onSaved,
  onCancel,
  submitLabel,
  compact = false,
}: PatientFormProps) {
  const [form, setForm] = useState<FormState>(() => initialState(patient));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sameAsPhone = useMemo(
    () => form.phone.trim() !== "" && form.whatsappNumber.trim() === form.phone.trim(),
    [form.phone, form.whatsappNumber],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the field's error as soon as the user edits it.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      whatsappNumber: form.whatsappNumber.trim() || undefined,
      email: form.email.trim() || undefined,
      dateOfBirth: form.dateOfBirth,
      preferredChannel: form.preferredChannel,
      notes: form.notes.trim() || undefined,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = patient
        ? await updatePatient(patient.id, payload)
        : await createPatient(payload);
      if (!saved) {
        setSubmitError("That patient could no longer be found.");
        return;
      }
      onSaved(saved);
    } catch {
      setSubmitError("Something went wrong saving this patient. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={compact ? "space-y-4" : "space-y-6"}>
      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <Field
          className={compact ? undefined : "sm:col-span-2"}
          label="Full name"
          required
          htmlFor="fullName"
          error={errors.fullName}
        >
          <input
            id="fullName"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="e.g. Kwabena Owusu"
            autoComplete="name"
            className={inputClass(!!errors.fullName)}
          />
        </Field>

        <Field label="Phone" required htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+233 24 123 4567"
            autoComplete="tel"
            className={inputClass(!!errors.phone)}
          />
        </Field>

        <Field
          label="WhatsApp number"
          htmlFor="whatsappNumber"
          error={errors.whatsappNumber}
          hint={
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={sameAsPhone}
                onChange={(e) => set("whatsappNumber", e.target.checked ? form.phone.trim() : "")}
                disabled={!form.phone.trim()}
                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Same as phone
            </label>
          }
        >
          <input
            id="whatsappNumber"
            type="tel"
            inputMode="tel"
            value={form.whatsappNumber}
            onChange={(e) => set("whatsappNumber", e.target.value)}
            placeholder="+233 24 123 4567"
            className={inputClass(!!errors.whatsappNumber)}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email} hint="Optional">
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="patient@example.com"
            autoComplete="email"
            className={inputClass(!!errors.email)}
          />
        </Field>

        <Field
          label="Date of birth"
          required
          htmlFor="dateOfBirth"
          error={errors.dateOfBirth}
        >
          <input
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            className={inputClass(!!errors.dateOfBirth)}
          />
        </Field>

        <Field
          className={compact ? undefined : "sm:col-span-2"}
          label="Preferred communication channel"
          required
          hint="How reminders and follow-ups reach this patient."
        >
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((channel) => {
              const style = CHANNEL_STYLES[channel];
              const active = form.preferredChannel === channel;
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => set("preferredChannel", channel)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition",
                    active
                      ? "border-teal-300 bg-teal-100 text-teal-800 ring-2 ring-teal-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                  {style.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          className={compact ? undefined : "sm:col-span-2"}
          label="Notes"
          htmlFor="notes"
          hint="Optional — anything the front desk should know."
        >
          <textarea
            id="notes"
            rows={compact ? 2 : 3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="e.g. Prefers morning appointments."
            className={cn(inputClass(false), "resize-y")}
          />
        </Field>
      </div>

      {submitError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel ?? (patient ? "Save changes" : "Add patient")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <p className="text-xs text-slate-400">
          <span className="text-rose-500">*</span> Required
        </p>
      </div>
    </form>
  );
}

// --- field primitives -----------------------------------------------------

function inputClass(hasError: boolean): string {
  return cn(
    "w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-500",
    hasError
      ? "ring-2 ring-rose-300 focus:ring-rose-500"
      : "focus:ring-2 focus:ring-teal-600",
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
        {typeof hint === "string" ? (
          <span className="text-xs text-slate-400">{hint}</span>
        ) : (
          hint
        )}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
