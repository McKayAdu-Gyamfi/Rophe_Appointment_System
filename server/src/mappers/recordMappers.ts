// ---------------------------------------------------------------------------
// Prisma rows → the shapes in client/src/lib/types.ts.
//
// Nothing returns a Prisma row directly. Prisma's field names and the
// frontend's are close enough to look interchangeable (`registeredAt` vs
// `registeredDate`, `active` vs `isActive`, `revisions` vs `history`) and are
// not, and because lib/api.ts casts responses with an unchecked generic, every
// one of those differences typechecks cleanly and then reads as `undefined` at
// runtime. A mapper per model is what makes the contract real.
//
// doctorMapper.ts already did this for Doctor; these follow it.
// ---------------------------------------------------------------------------

import type {
  Appointment,
  AppointmentType,
  AvailabilityException,
  ClinicSettings,
  DoctorAvailability,
  Message,
  MessageTemplate,
  Patient,
  PatientRequest,
  TemplateRevision,
} from "@prisma/client";
import {
  appointmentStatusCodec,
  channelCodec,
  deliveryStatusCodec,
  messageTypeCodec,
  requestStatusCodec,
  requestTypeCodec,
} from "./enums";
import { toDateKey, toTimeKey } from "./datetime";

// --- Patients --------------------------------------------------------------

export function toWirePatient(patient: Patient) {
  return {
    id: patient.id,
    fullName: patient.fullName,
    phone: patient.phone,
    whatsappNumber: patient.whatsappNumber ?? undefined,
    email: patient.email ?? undefined,
    // The column is a DATE and the frontend field is a required string, so a
    // missing date of birth becomes "" rather than undefined — the screens
    // format this value, and a missing key renders "Invalid Date".
    dateOfBirth: patient.dateOfBirth ? toDateKey(patient.dateOfBirth) : "",
    preferredChannel: channelCodec.toWire(patient.preferredChannel),
    // NOT createdAt. The recall clock anchors on when the clinic first
    // registered them, which for a record moved off the paper diary is years
    // before the row existed.
    registeredDate: toDateKey(patient.registeredAt),
    notes: patient.notes ?? undefined,
  };
}

// --- Appointments ----------------------------------------------------------

/** The type relation carries the name the frontend shows, so it is required. */
export type AppointmentWithType = Appointment & { type: AppointmentType };

export function toWireAppointment(appointment: AppointmentWithType) {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    appointmentType: appointment.type.name,
    date: toDateKey(appointment.startsAt),
    time: toTimeKey(appointment.startsAt),
    durationMinutes: appointment.durationMinutes,
    status: appointmentStatusCodec.toWire(appointment.status),
    createdAt: appointment.createdAt.toISOString(),
    notes: appointment.notes ?? undefined,
  };
}

// --- Appointment types and settings ----------------------------------------

export function toWireAppointmentType(type: AppointmentType) {
  return {
    id: type.id,
    name: type.name,
    durationMinutes: type.durationMinutes,
    sortOrder: type.sortOrder,
    isActive: type.active,
  };
}

export function toWireClinicSettings(settings: ClinicSettings) {
  return {
    id: settings.id,
    firstVisitMinutes: settings.firstVisitMinutes,
    slotMinutes: settings.slotMinutes,
    dayStart: settings.dayStart,
    dayEnd: settings.dayEnd,
    // The frontend declares these two names; the schema calls the same two
    // numbers lapsingMonths (the warning band) and recallMonths (the worklist
    // threshold). Mapped lowest-first to keep them ordered the way the recall
    // states run: active → lapsing → lapsed. See the note in the PR.
    recallThresholdLapsed: settings.lapsingMonths,
    recallThresholdOverdue: settings.recallMonths,
    recallCooldownDays: settings.recallCooldownDays,
  };
}

// --- Message templates -----------------------------------------------------

export type TemplateWithRevisions = MessageTemplate & { revisions: TemplateRevision[] };

function toWireRevision(revision: TemplateRevision) {
  return {
    version: revision.version,
    body: revision.body,
    emailSubject: revision.emailSubject,
    savedAt: revision.savedAt.toISOString(),
    savedBy: revision.savedByName,
  };
}

export function toWireTemplate(template: TemplateWithRevisions) {
  return {
    id: template.id,
    type: messageTypeCodec.toWire(template.type),
    description: template.description,
    body: template.body,
    emailSubject: template.emailSubject,
    version: template.version,
    updatedAt: template.updatedAt.toISOString(),
    updatedBy: template.updatedByName,
    // `history`, newest first — template-editor.tsx reads .length on this
    // unconditionally, so it must always be an array.
    history: template.revisions.map(toWireRevision),
  };
}

// --- Messages --------------------------------------------------------------

/**
 * `contentPreview` on the wire is `body` in the table: the text that actually
 * went out, rendered at send time. It is deliberately not a pointer to a
 * template — editing the wording must never rewrite what a patient was
 * already sent.
 */
export function toWireMessage(message: Message) {
  return {
    id: message.id,
    patientId: message.patientId,
    appointmentId: message.appointmentId ?? undefined,
    channel: channelCodec.toWire(message.channel),
    type: messageTypeCodec.toWire(message.type),
    sentAt: message.sentAt.toISOString(),
    deliveryStatus: deliveryStatusCodec.toWire(message.deliveryStatus),
    contentPreview: message.body,
  };
}

// --- Availability ----------------------------------------------------------

/**
 * The frontend's DoctorAvailability carries an `isAvailable` flag; the table
 * has no such column, because a window that exists is open and a day with no
 * rows is closed. There is deliberately no stored `false` to keep in step with
 * the rows around it, so the flag is re-added here as the constant it is —
 * lib/schedule.ts filters on it.
 */
export function toWireAvailability(window: DoctorAvailability) {
  return {
    doctorId: window.doctorId,
    dayOfWeek: window.dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime,
    isAvailable: true as const,
  };
}

/** A one-off change to a single date, overriding the weekly pattern. */
export function toWireException(exception: AvailabilityException) {
  return {
    id: exception.id,
    doctorId: exception.doctorId,
    date: toDateKey(exception.date),
    isClosed: exception.isClosed,
    startTime: exception.startTime ?? undefined,
    endTime: exception.endTime ?? undefined,
    reason: exception.reason ?? undefined,
  };
}

// --- Patient requests ------------------------------------------------------

export function toWirePatientRequest(request: PatientRequest) {
  return {
    id: request.id,
    appointmentId: request.appointmentId,
    patientId: request.patientId,
    requestType: requestTypeCodec.toWire(request.requestType),
    // One nullable instant becomes the frontend's optional date/time pair.
    requestedDate: request.requestedStartsAt ? toDateKey(request.requestedStartsAt) : undefined,
    requestedTime: request.requestedStartsAt ? toTimeKey(request.requestedStartsAt) : undefined,
    reason: request.reason ?? undefined,
    status: requestStatusCodec.toWire(request.status),
  };
}
