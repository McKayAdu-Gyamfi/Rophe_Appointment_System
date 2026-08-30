"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, History, Info, RotateCcw, Save, X } from "lucide-react";
import { updateMessageTemplate, revertMessageTemplate } from "@/lib/api";
import {
  hasBlockingIssue,
  renderTemplate,
  smsCost,
  validateTemplate,
  variablesFor,
  type RenderContext,
} from "@/lib/templates";
import type { Appointment, Doctor, MessageTemplate, Patient } from "@/lib/types";
import { MESSAGE_TYPE_STYLES } from "@/lib/status-styles";
import { fmtDateTime } from "@/lib/format";
import { CLINIC } from "@/lib/clinic";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Template editor.
//
// Two halves: the words on the left, what a patient actually receives on the
// right. The preview is the part that matters — nobody who is not a programmer
// should have to hold "{{first_name}} renders as Ama" in their head, and the
// clinic will not trust wording they cannot see rendered before it goes out.
//
// The SMS counter sits under the preview for the same reason: the cost of a
// friendlier message is only visible while you are writing it.
// ---------------------------------------------------------------------------

export interface TemplateEditorProps {
  template: MessageTemplate;
  patients: Patient[];
  appointments: Appointment[];
  doctors: Doctor[];
  /** Name recorded against this edit in the version history. */
  savedBy: string;
  onClose: () => void;
  onSaved: (template: MessageTemplate) => void;
}

type Field = "body" | "subject";

export function TemplateEditor({
  template,
  patients,
  appointments,
  doctors,
  savedBy,
  onClose,
  onSaved,
}: TemplateEditorProps) {
  const [body, setBody] = useState(template.body);
  const [emailSubject, setEmailSubject] = useState(template.emailSubject);
  const [patientId, setPatientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<Field>("body");

  const typeStyle = MESSAGE_TYPE_STYLES[template.type];
  const variables = variablesFor(template.type);
  const dirty = body !== template.body || emailSubject !== template.emailSubject;

  // Preview against a patient who actually has an appointment, so the date and
  // time fields resolve to something real rather than to their fallbacks.
  const previewPatient = useMemo(() => {
    const chosen = patients.find((p) => p.id === patientId);
    if (chosen) return chosen;
    const withAppointment = patients.find((p) => appointments.some((a) => a.patientId === p.id));
    return withAppointment ?? patients[0];
  }, [patients, appointments, patientId]);

  const context: RenderContext | undefined = useMemo(() => {
    if (!previewPatient) return undefined;
    const appointment = appointments
      .filter((a) => a.patientId === previewPatient.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      patient: previewPatient,
      appointment,
      doctor: doctors.find((d) => d.id === appointment?.doctorId),
    };
  }, [previewPatient, appointments, doctors]);

  const renderedBody = context ? renderTemplate(body, context) : body;
  const renderedSubject = context ? renderTemplate(emailSubject, context) : emailSubject;
  const cost = smsCost(renderedBody);

  const issues = validateTemplate(template.type, body, emailSubject);
  const blocked = hasBlockingIssue(issues);

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  // Escape closes (or asks first, if there is something to lose); body scroll
  // locks while the modal is up — same treatment as NewPatientDialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  /** Drop a field in at the cursor of whichever input was last focused. */
  function insertField(key: string) {
    const token = `{{${key}}}`;
    const field = lastFocused.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const current = field === "subject" ? emailSubject : body;
    const set = field === "subject" ? setEmailSubject : setBody;

    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    set(current.slice(0, start) + token + current.slice(end));

    // The caret is restored after React has written the new value back.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSave() {
    if (blocked || saving) return;
    setSaving(true);
    const updated = await updateMessageTemplate(template.type, {
      body: body.trim(),
      emailSubject: emailSubject.trim(),
      savedBy,
    });
    setSaving(false);
    if (updated) onSaved(updated);
    onClose();
  }

  async function handleRevert(version: number) {
    setSaving(true);
    const updated = await revertMessageTemplate(template.type, version, savedBy);
    setSaving(false);
    if (updated) {
      setBody(updated.body);
      setEmailSubject(updated.emailSubject);
      onSaved(updated);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-4xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2
              id="template-editor-title"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              {typeStyle.label} message
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{template.description}</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          {/* --- Editor ---------------------------------------------------- */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="template-subject"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Email subject
                <span className="ml-1.5 font-normal text-slate-400">
                  — used only when the patient prefers email
                </span>
              </label>
              <input
                id="template-subject"
                ref={subjectRef}
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                onFocus={() => (lastFocused.current = "subject")}
                className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label
                htmlFor="template-body"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Message
                <span className="ml-1.5 font-normal text-slate-400">
                  — goes out on WhatsApp, SMS and email
                </span>
              </label>
              <textarea
                id="template-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => (lastFocused.current = "body")}
                rows={6}
                className="w-full resize-y rounded-xl bg-slate-100 px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* Insertable fields */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">
                Insert a detail
                <span className="ml-1.5 font-normal text-slate-400">
                  — filled in for each patient
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertField(v.key)}
                    title={v.hint}
                    className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {template.type === "birthday" && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  Birthday messages are not tied to an appointment, so there is no date, time
                  or doctor to fill in.
                </p>
              )}
            </div>

            {/* Validation */}
            {issues.length > 0 && (
              <ul className="space-y-1.5">
                {issues.map((issue, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
                      issue.level === "error"
                        ? "bg-rose-50 text-rose-800"
                        : "bg-amber-50 text-amber-800",
                    )}
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* --- Preview --------------------------------------------------- */}
          <div className="space-y-4">
            <div className="rounded-panel bg-slate-100 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">What the patient receives</p>
                {patients.length > 0 && (
                  <select
                    aria-label="Preview this message for"
                    value={previewPatient?.id ?? ""}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="max-w-[55%] cursor-pointer truncate rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {renderedSubject.trim() && (
                <p className="mb-2 truncate text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Subject:</span> {renderedSubject}
                </p>
              )}

              <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">
                {renderedBody.trim() || (
                  <span className="text-slate-400">Nothing to send yet.</span>
                )}
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                From {CLINIC.name} · {CLINIC.phone}
              </p>
            </div>

            {/* SMS cost */}
            <div
              className={cn(
                "rounded-xl px-3 py-2.5 text-xs",
                cost.segments > 1 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600",
              )}
            >
              <p className="font-semibold">
                {cost.segments} SMS {cost.segments === 1 ? "message" : "messages"} per patient
              </p>
              <p className="mt-0.5">
                {cost.units} characters used, {Math.max(cost.remaining, 0)} left · {cost.encoding}
                {cost.encoding === "Unicode" && " (an emoji or special character drops the limit to 70)"}
              </p>
            </div>

            {/* Version history */}
            <div className="rounded-xl bg-slate-100 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
                className="flex w-full items-center gap-2 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
              >
                <History className="h-3.5 w-3.5 text-slate-400" />
                Version {template.version} · edited by {template.updatedBy}
                {template.history.length > 0 && (
                  <span className="ml-auto text-teal-700">
                    {historyOpen ? "Hide" : `${template.history.length} earlier`}
                  </span>
                )}
              </button>
              <p className="mt-1 pl-5 text-[11px] text-slate-500">
                {fmtDateTime(template.updatedAt)}
              </p>

              {historyOpen && template.history.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  {template.history.map((rev) => (
                    <li key={rev.version} className="rounded-lg bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          v{rev.version} · {rev.savedBy}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleRevert(rev.version)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 transition hover:text-teal-900"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </button>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{rev.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          {confirmDiscard ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="mr-auto text-sm text-slate-600">
                Discard your changes to this message?
              </p>
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Discard
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="mr-auto text-xs text-slate-500">
                Applies to every {typeStyle.label.toLowerCase()} sent from now on. Messages
                already sent keep their original wording.
              </p>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={blocked || !dirty || saving}
                className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save wording"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
