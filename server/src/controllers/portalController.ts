import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict } from "../lib/httpError";
import { dateOnlySchema, timeSchema } from "../middleware/validate";
import { requestTypeCodec } from "../mappers/enums";
import { toInstant } from "../mappers/datetime";
import {
  toWireAppointmentType,
  toWireAvailability,
  toWireClinicSettings,
  toWirePatientRequest,
} from "../mappers/recordMappers";
import { toDateKey, toTimeKey } from "../mappers/datetime";
import { resolvePortalToken } from "../services/portal";

// ---------------------------------------------------------------------------
// What a patient can see and do with their link.
//
// Everything here is public and unauthenticated, so the shape of the response
// is the security boundary: this returns what the portal page renders and
// nothing else. The patient's own name is in it because the page greets them
// with it; their phone number, email, date of birth, notes and the rest of
// their record are not, because the page never shows them and a link that
// leaks into a group chat should not hand over a medical record.
//
// The token is never trusted to say who the patient is beyond the appointment
// it belongs to. A request body naming a patientId or appointmentId is
// ignored — those come from the token.
// ---------------------------------------------------------------------------

async function loadScheduleConfig() {
  const [settings, types] = await Promise.all([
    prisma.clinicSettings.findUnique({ where: { id: "clinic" } }),
    prisma.appointmentType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return {
    clinicSettings: settings ? toWireClinicSettings(settings) : null,
    appointmentTypes: types.map(toWireAppointmentType),
  };
}

export async function getPortalAppointment(req: Request, res: Response) {
  const { appointment } = await resolvePortalToken(req.params.token);

  const [availability, requests, config] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: { doctorId: appointment.doctorId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.patientRequest.findMany({
      where: { appointmentId: appointment.id },
      orderBy: { createdAt: "desc" },
    }),
    loadScheduleConfig(),
  ]);

  res.json({
    appointment: {
      id: appointment.id,
      appointmentType: appointment.type.name,
      date: toDateKey(appointment.startsAt),
      time: toTimeKey(appointment.startsAt),
      durationMinutes: appointment.durationMinutes,
      status: appointment.status.toLowerCase(),
    },
    // Name only. The page greets the patient; it does not display their record.
    patient: { fullName: appointment.patient.fullName },
    doctor: {
      fullName: appointment.doctor.user.fullName,
      specialty: appointment.doctor.specialty,
    },
    availability: availability.map(toWireAvailability),
    requests: requests.map(toWirePatientRequest),
    ...config,
  });
}

export async function confirmPortalAppointment(req: Request, res: Response) {
  const { appointment } = await resolvePortalToken(req.params.token);

  if (appointment.status === "CANCELLED") {
    throw conflict("That appointment has been cancelled. Call the clinic to rebook.");
  }
  if (appointment.status === "ATTENDED") {
    throw conflict("That visit has already happened.");
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CONFIRMED" },
  });

  res.json({ status: updated.status.toLowerCase() });
}

export const portalRequestSchema = z
  .object({
    requestType: z.enum(requestTypeCodec.wireValues),
    requestedDate: dateOnlySchema.optional(),
    requestedTime: timeSchema.optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => data.requestType !== "reschedule" || (data.requestedDate && data.requestedTime),
    {
      message: "Choose a date and time you would prefer.",
      path: ["requestedDate"],
    },
  );

export async function createPortalRequest(req: Request, res: Response) {
  const { appointment } = await resolvePortalToken(req.params.token);
  const input = req.body as z.infer<typeof portalRequestSchema>;

  if (appointment.status === "CANCELLED") {
    throw conflict("That appointment has already been cancelled.");
  }

  // One open request at a time. Two contradictory asks sitting in the queue is
  // a question for front desk that the patient did not mean to pose.
  const open = await prisma.patientRequest.findFirst({
    where: { appointmentId: appointment.id, status: "PENDING" },
  });
  if (open) {
    throw conflict("You already have a request waiting. The clinic will be in touch shortly.");
  }

  const requestedStartsAt =
    input.requestedDate && input.requestedTime
      ? toInstant(input.requestedDate, input.requestedTime)
      : null;

  if (requestedStartsAt && requestedStartsAt.getTime() < Date.now()) {
    throw badRequest("Choose a date in the future.");
  }

  // Creating a request never touches the appointment — staff keep the calendar.
  const created = await prisma.patientRequest.create({
    data: {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      requestType: requestTypeCodec.toDb(input.requestType),
      requestedStartsAt,
      reason: input.reason,
      status: "PENDING",
    },
  });

  res.status(201).json(toWirePatientRequest(created));
}
