"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Pencil } from "lucide-react";
import {
  getAppointments,
  getDoctors,
  getMessageTemplates,
  getPatients,
  onTemplatesChanged,
} from "@/lib/api";
import { renderTemplate, smsCost, type RenderContext } from "@/lib/templates";
import type { Appointment, Doctor, MessageTemplate, Patient } from "@/lib/types";
import { MESSAGE_TYPE_STYLES } from "@/lib/status-styles";
import { fmtRelative } from "@/lib/format";
import { useAuth } from "@/lib/role-context";
import { TemplateEditor } from "./template-editor";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Templates tab.
//
// Four messages, one per type. The clinic writes the words; the system fills
// in the patient's name, date and time at send time. Editing one changes every
// future send of that type — messages already in the log keep the text that
// actually went out.
// ---------------------------------------------------------------------------

export function TemplatesPanel() {
  const { session, role } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  // Wording is standing policy for every patient, so only front desk edits it.
  // Doctors reaching this page by URL get the same view, read-only.
  const canEdit = role === "front-desk";

  useEffect(() => {
    let active = true;
    (async () => {
      const [tpls, pts, appts, docs] = await Promise.all([
        getMessageTemplates(),
        getPatients(),
        getAppointments(),
        getDoctors(),
      ]);
      if (!active) return;
      setTemplates(tpls);
      setPatients(pts);
      setAppointments(appts);
      setDoctors(docs);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return onTemplatesChanged(() => {
      void getMessageTemplates().then(setTemplates);
    });
  }, []);

  // One shared sample so every card previews against the same patient — the
  // list is for comparing wording, not for checking a particular record.
  const sample: RenderContext | undefined = useMemo(() => {
    const patient =
      patients.find((p) => appointments.some((a) => a.patientId === p.id)) ?? patients[0];
    if (!patient) return undefined;
    const appointment = appointments
      .filter((a) => a.patientId === patient.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      patient,
      appointment,
      doctor: doctors.find((d) => d.id === appointment?.doctorId),
    };
  }, [patients, appointments, doctors]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-panel bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>
          These are the words sent automatically. Edit one and every future message of that
          type uses the new wording — messages already sent keep what they said.{" "}
          {!canEdit && (
            <span className="font-medium text-slate-500">
              Front-desk staff can make changes here.
            </span>
          )}
        </p>
      </div>

      <ul className="space-y-3">
        {templates.map((template) => {
          const typeStyle = MESSAGE_TYPE_STYLES[template.type];
          const rendered = sample ? renderTemplate(template.body, sample) : template.body;
          const cost = smsCost(rendered);

          return (
            <li key={template.id} className="rounded-panel bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
                      {typeStyle.label}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium",
                        typeStyle.badge,
                      )}
                    >
                      v{template.version}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{template.description}</p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(template)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit wording
                  </button>
                )}
              </div>

              <div className="mt-3 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-800">
                {rendered}
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                {sample ? `Previewed for ${sample.patient.fullName}` : "No patients to preview"} ·{" "}
                {cost.segments} SMS {cost.segments === 1 ? "message" : "messages"} · edited{" "}
                {fmtRelative(template.updatedAt)} by {template.updatedBy}
              </p>
            </li>
          );
        })}
      </ul>

      {editing && (
        <TemplateEditor
          template={editing}
          patients={patients}
          appointments={appointments}
          doctors={doctors}
          savedBy={session?.fullName ?? "Front desk"}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setEditing(updated);
          }}
        />
      )}
    </>
  );
}
